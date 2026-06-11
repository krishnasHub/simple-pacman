# Simple Pac-Man

A browser-based maze game inspired by the classic arcade game Pac-Man, built with React and Node.js. Every session generates a brand-new procedural maze, so no two games are alike.

---

## What is Pac-Man?

Pac-Man is one of the most iconic arcade games of all time, originally released by Namco in 1980. The player navigates a character through a maze, collecting dots while avoiding colourful ghosts. Eating a "power pellet" temporarily turns the ghosts vulnerable, letting the player turn the tables. The goal is to clear every dot in the maze without losing all your lives.

> **Legal notice:** This project is an independently developed, fan-made tribute. "Pac-Man" is a registered trademark of Bandai Namco Entertainment Inc. This game shares no code, assets, or copyrighted material with the original. The general game mechanics used here (maze navigation, dot collection, power-ups, enemy avoidance) are well-established game conventions not protected by copyright. No commercial use is intended or implied.

---

## Features

- **Procedural maze** — a new maze is generated every time you load or win, using a recursive-backtracking algorithm. No two games look the same.
- **Wrap-around portals** — four glowing portals at the mid-edges of the maze teleport you (and ghosts) to the opposite side.
- **Central ghost house** — ghosts spawn from a dedicated room at the centre of every maze. Eaten ghosts respawn there after a short delay.
- **Power pellets** — collect one to turn all ghosts blue and vulnerable. Eat a scared ghost for bonus points.
- **Same-map death reset** — losing a life resets the current maze (all dots reappear) so you keep playing the same layout.
- **Ghost mood panel** — each ghost has a name and a live "state of mind" that reflects their current behaviour (wandering, hunting, terrified, defeated, etc.), with cycling flavour text.
- **Win → new map** — clearing all dots and power pellets auto-generates a fresh maze after a brief victory screen.

### The Ghosts

| Name | Colour | Personality |
|------|--------|-------------|
| **Blaze** | Red | Aggressive chaser — always hunting via shortest path |
| **Nimbus** | Pink | Determined chaser — follows the same BFS logic |
| **Glitch** | Cyan | Erratic — moves randomly through the maze |
| **Dusk** | Orange | Unpredictable — also roams freely |

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
| Arrow keys or **W A S D** | Move Pac-Man one step |
| *(no key)* | Pac-Man stays still |

Each key press moves Pac-Man exactly one cell. Hold nothing and he stops — plan your route!

---

## Scoring

| Action | Points |
|--------|--------|
| Collect a dot | 10 |
| Collect a power pellet | 50 |
| Eat a scared ghost | 200 |

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
