# Simple Pac-Man

A browser-based maze game inspired by the classic arcade game Pac-Man, built with React and Node.js. Every session generates a brand-new procedural maze, so no two games are alike.

---

## What is Pac-Man?

Pac-Man is one of the most iconic arcade games of all time, originally released by Namco in 1980. The player navigates a character through a maze, collecting dots while avoiding colourful ghosts. Eating a "power pellet" temporarily turns the ghosts vulnerable, letting the player turn the tables. The goal is to clear every dot in the maze without losing all your lives.

> **Legal notice:** This project is an independently developed, fan-made tribute. "Pac-Man" is a registered trademark of Bandai Namco Entertainment Inc. This game shares no code, assets, or copyrighted material with the original. The general game mechanics used here (maze navigation, dot collection, power-ups, enemy avoidance) are well-established game conventions not protected by copyright. No commercial use is intended or implied.

---

## Features

- **Procedural maze** — a new maze is generated every time you load or win, using a recursive-backtracking algorithm. No two games look the same.
- **Wrap-around portals** — glowing portal cells at the maze edges teleport you (and ghosts) to the opposite side. Portals start at the four mid-edges and can expand as missiles blast open new border walls.
- **Central ghost house** — ghosts spawn from a dedicated room at the centre of every maze. Eaten ghosts respawn there after a short delay.
- **Power pellets** — collect one to turn all ghosts blue and vulnerable. Eat a scared ghost for bonus points.
- **Missiles** — fire a missile with Space Bar in your current direction of travel. Missiles that hit a ghost eliminate it; missiles that hit a wall permanently break it, reshaping the maze. Hitting a border wall also opens a matching portal on the opposite side.
- **Missile pickups** — missile packs are scattered across the map (more near the centre for higher risk/reward). Pick one up to gain +1 missile. Packs respawn at new random locations every 30 seconds.
- **Persistent death state** — broken walls, eaten dots, and collected pickups all persist when you die. Only player and ghost positions reset.
- **Ghost mood panel** — each ghost has a name and a live "state of mind" that reflects their current behaviour (wandering, hunting, terrified, defeated, etc.), with cycling flavour text and a missile ammo indicator.
- **Win → new map** — clearing all dots and power pellets auto-generates a fresh maze after a brief victory screen.

### The Ghosts

Each ghost has a distinct personality that shapes both how it moves and how it uses its three missiles. Ghost missiles **never** target the player directly — they are used purely to reshape the maze and carve shortcuts toward each ghost's objective. Once a ghost's three missiles are spent they are gone permanently, even through death.

| Name | Colour | Movement | Missile Strategy |
|------|--------|----------|-----------------|
| **Blaze** | Red | Aggressive — always takes the BFS shortest path to the player | Fires to break a wall that most shortens the route to you. Only shoots when the path is long (>6 cells) and a wall break saves 2+ steps |
| **Nimbus** | Pink | Strategic — lingers near power pellets and missile pickups, waiting to ambush | Fires to carve a faster route between pickups. Scouts the maze by patrolling high-value areas rather than direct pursuit |
| **Glitch** | Cyan | Chaotic — moves randomly with a ~35% bias toward the player's direction | Fires randomly into adjacent walls, creating unpredictable new paths through the maze |
| **Dusk** | Orange | Coordinator — positions itself to flank the player from the opposite side of the other ghosts | Finds the single wall that, if broken, most reduces the *average* path length from all other ghosts to the player, then fires to open it |

All ghost missiles expire after 10 seconds if they don't hit anything.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer

### Installation

```bash
git clone https://github.com/krishnasHub/simple-pacman.git
cd simple-pacman
npm install
```

### Running the game

**Option 1 — double-click script (Windows)**

Run `start.bat` (Command Prompt) or right-click `start.ps1` → *Run with PowerShell*.

**Option 2 — npm**

```bash
npm start
```

Both options start the Vite dev server and open your default browser automatically at `http://localhost:5173`. Press **Ctrl+C** in the terminal to stop.

---

## Controls

| Key | Action |
|-----|--------|
| Arrow keys or **W A S D** | Move Pac-Man (tap = one step, hold = continuous) |
| **Space Bar** | Fire a missile in the current direction of travel |
| *(no key)* | Pac-Man stays still |

Tap a direction key to move one cell at a time. Hold it down and Pac-Man keeps moving at a steady pace until you release or change direction.

---

## Scoring

| Action | Points |
|--------|--------|
| Collect a dot | 10 |
| Collect a power pellet | 50 |
| Eat a scared ghost | 200 |
| Kill a ghost with a missile | 300 |

---

## Project Structure

```
simple-pacman/
├── src/
│   ├── maze.js          # Procedural maze generation (recursive backtracking DFS)
│   ├── gameEngine.js    # Game logic: movement, collision, BFS ghost pathfinding
│   ├── Game.jsx         # Main canvas component + game loop (requestAnimationFrame)
│   ├── App.jsx          # App shell
│   ├── main.jsx         # React entry point
│   └── index.css        # Styles
├── src/__tests__/
│   ├── gameEngine.test.js   # Unit tests for collision, BFS, canMove, initGameState
│   └── maze.test.js         # Unit tests for maze generation invariants
├── server.js            # Express server (serves built app in production)
├── start.js             # Launch script: starts Vite + opens browser + handles Ctrl+C
├── start.bat            # Windows batch launcher
├── start.ps1            # PowerShell launcher
└── vite.config.js       # Vite + React config
```

## Tech Stack

- **Frontend:** React 18, Vite, HTML5 Canvas
- **Server:** Node.js, Express
- **Tests:** Vitest (38 tests)
- **No game engine libraries** — all maze generation, pathfinding (BFS), and rendering are written from scratch.

---

## Running Tests

```bash
npm test
```

---

## Development

```bash
npm run dev     # Start both Vite (port 5173) and Express (port 3001) with hot reload
npm run build   # Production build → dist/
npm run serve   # Serve the production build via Express
```
