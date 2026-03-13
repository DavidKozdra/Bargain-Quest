
# Bargain Quest
<img width="48" height="48" alt="image" src="https://github.com/user-attachments/assets/5ae79437-9c08-41d1-be9e-133d198553b8" />


**Bargain Quest** is a browser-based, turn-based trading strategy game. It borrows the travel-and-progression feel of *Mount & Blade*, but the core loop is economics rather than conquest: buy low, sell high, follow seasonal demand, manage cargo, and grow wealth across a living map.

This repository also contains **`Koz_Engine_Lib/`**, a reusable engine layer being extracted from the game. If you are here for the engine rather than the game, start with [`Koz_Engine_Lib/README.md`](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/Koz_Engine_Lib/README.md).

## What Is In This Repo

- The Bargain Quest game runtime, content, and UI.
- `Koz_Engine_Lib/`, a transitional reusable engine library.

## Run The Game Locally

The game entry point is [`index.html`](/home/davidk/Documents/CODE/GITHUB/Bargain-Quest/index.html), 

Serve the repository over a simple local HTTP server from the repo root, then open `http://localhost:8000/index.html`.

Example:

```bash
python3 -m http.server 8000
```
<img width="2367" height="1495" alt="image" src="https://github.com/user-attachments/assets/84d7e5de-5e8b-49e5-b3d6-269c9a1c4993" />

Why use a server:

- It matches how the browser loads the project in normal use.
- It avoids `file://` quirks around script and asset loading.

## Project Links

- [Play the demo on itch.io](https://magentaautumn.itch.io/bargain-quest?secret=lttUL2Dty90R7A501pSZ0pfZWu4)
- [GitHub repository](https://github.com/DavidKozdra/Bargain-Quest)

![Project image](image.png)

## Screenshots




Old Logo 

V1 changed alot but the core astar and UI manager is here and helpful.

<img width="351" height="255" alt="Logo" src="https://github.com/user-attachments/assets/e1108116-7973-42cd-b963-131a672635b1" />

<img width="1569" height="1103" alt="Gameplay" src="https://github.com/user-attachments/assets/9d5c6da9-b45f-405a-8409-742d896eaee2" />

---

<img width="2245" height="1432" alt="Shop UI" src="https://github.com/user-attachments/assets/57555490-9b54-4a9c-8f7f-353adb4379ef" />
