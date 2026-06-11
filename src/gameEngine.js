export const CELL_SIZE = 24
export const COLS = 23
export const ROWS = 23
export const TICK_MS = 150
export const GHOST_TICK_MS = 360
export const SCARED_MS = 8000

export const GHOST_NAMES = ['Blaze', 'Nimbus', 'Glitch', 'Dusk']

// Mid-point indices for the wrap-around portals (23×23 grid)
export const MID_COL = 11  // x=11: left/right portals are at y=11
export const MID_ROW = 11  // y=11: top/bottom portals are at x=11

/**
 * Returns true if (x, y) is within bounds and is a path cell (not a wall).
 */
export function canMove(grid, x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS && grid[y][x] === 0
}

/**
 * Computes the destination of a single-step move, applying wrap-around at
 * the four border portals (mid-edges). Returns {x, y} of the reachable
 * destination, or null if the destination is a wall or an invalid exit.
 */
export function getWrappedPosition(grid, fromX, fromY, dx, dy) {
  let toX = fromX + dx
  let toY = fromY + dy

  // Apply wrap-around when stepping off a portal border cell
  if (toX < 0   && fromY === MID_ROW) toX = COLS - 1
  else if (toX >= COLS && fromY === MID_ROW) toX = 0
  else if (toY < 0   && fromX === MID_COL) toY = ROWS - 1
  else if (toY >= ROWS && fromX === MID_COL) toY = 0
  else if (toX < 0 || toX >= COLS || toY < 0 || toY >= ROWS) return null

  if (grid[toY][toX] !== 0) return null
  return { x: toX, y: toY }
}

/**
 * BFS from `from` toward `to` through the grid, respecting wrap-around portals.
 * Returns the first {dx, dy} step along the shortest path.
 * Returns {dx: 0, dy: 0} if no path exists or already at destination.
 */
export function bfsStep(grid, from, to) {
  if (from.x === to.x && from.y === to.y) return { dx: 0, dy: 0 }

  const visited = new Set()
  visited.add(`${from.x},${from.y}`)

  const queue = []
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ]

  for (const d of dirs) {
    const dest = getWrappedPosition(grid, from.x, from.y, d.dx, d.dy)
    if (dest && !visited.has(`${dest.x},${dest.y}`)) {
      visited.add(`${dest.x},${dest.y}`)
      queue.push({ x: dest.x, y: dest.y, firstStep: d })
    }
  }

  let head = 0
  while (head < queue.length) {
    const { x, y, firstStep } = queue[head++]
    if (x === to.x && y === to.y) return firstStep

    for (const d of dirs) {
      const dest = getWrappedPosition(grid, x, y, d.dx, d.dy)
      if (dest) {
        const key = `${dest.x},${dest.y}`
        if (!visited.has(key)) {
          visited.add(key)
          queue.push({ x: dest.x, y: dest.y, firstStep })
        }
      }
    }
  }

  return { dx: 0, dy: 0 }
}

/**
 * Returns a valid random {dx, dy} step for a ghost, respecting wrap-around portals.
 * Prefers not to reverse the current direction.
 */
export function randomStep(grid, pos, prevDir) {
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ]

  const reverse = { dx: -prevDir.dx, dy: -prevDir.dy }
  const isValid = d => getWrappedPosition(grid, pos.x, pos.y, d.dx, d.dy) !== null

  const nonReverse = dirs.filter(d => isValid(d) && !(d.dx === reverse.dx && d.dy === reverse.dy))
  if (nonReverse.length > 0) return nonReverse[Math.floor(Math.random() * nonReverse.length)]

  const reverseOptions = dirs.filter(isValid)
  if (reverseOptions.length > 0) return reverseOptions[Math.floor(Math.random() * reverseOptions.length)]

  return { dx: 0, dy: 0 }
}

/**
 * Resolves a potential player-ghost collision at the current positions.
 * Returns 'ghost_eaten', 'player_hit', or null (no collision / ghost already eaten).
 * Called after EITHER the player OR a ghost moves — before timers are decremented.
 */
export function resolvePlayerGhostCollision(ghost, player) {
  if (ghost.eaten) return null
  if (ghost.x !== player.x || ghost.y !== player.y) return null
  return ghost.scared ? 'ghost_eaten' : 'player_hit'
}

/**
 * Creates the initial game state from the maze data returned by generateMaze.
 */
export function initGameState({ grid, playerStart, ghostStarts, pathCells, powerPellets, ghostHouseCenter }) {
  const ghostColors = ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852']

  return {
    grid,
    ghostHouseCenter,
    player: {
      x: playerStart.x,
      y: playerStart.y,
      dir: { dx: 1, dy: 0 },
      nextDir: { dx: 1, dy: 0 },
      mouthAngle: 0.25,
      mouthOpen: true,
    },
    ghosts: ghostStarts.slice(0, 4).map((pos, i) => ({
      x: pos.x,
      y: pos.y,
      color: ghostColors[i],
      name: GHOST_NAMES[i],
      dir: { dx: 0, dy: 0 },
      scared: false,
      scaredTimer: 0,
      eaten: false,
      respawnTimer: 0,
    })),
    pellets: new Set(pathCells.map(c => `${c.x},${c.y}`)),
    powerPellets: new Set(powerPellets.map(c => `${c.x},${c.y}`)),
    score: 0,
    lives: 3,
    phase: 'playing',
    dyingTimer: 0,
    totalPellets: pathCells.length,
  }
}
