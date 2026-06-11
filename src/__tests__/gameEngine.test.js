import { describe, it, expect } from 'vitest'
import {
  canMove,
  bfsStep,
  resolvePlayerGhostCollision,
  initGameState,
  COLS,
  ROWS,
} from '../gameEngine.js'

// ── Helpers ────────────────────────────────────────────────────────────────

/** All-path grid of the canonical maze dimensions (23×23). */
function openGrid(cols = COLS, rows = ROWS) {
  return Array.from({ length: rows }, () => new Array(cols).fill(0))
}

/** All-wall grid of the canonical maze dimensions (23×23). */
function walledGrid(cols = COLS, rows = ROWS) {
  return Array.from({ length: rows }, () => new Array(cols).fill(1))
}

// ── canMove ────────────────────────────────────────────────────────────────

describe('canMove', () => {
  it('returns true for an open cell within bounds', () => {
    const grid = openGrid()
    expect(canMove(grid, 0, 0)).toBe(true)
  })

  it('returns true for a cell in the middle of an open grid', () => {
    const grid = openGrid()
    expect(canMove(grid, 11, 11)).toBe(true)
  })

  it('returns false for a wall cell', () => {
    const grid = openGrid()
    grid[5][5] = 1
    expect(canMove(grid, 5, 5)).toBe(false)
  })

  it('returns false when x < 0', () => {
    const grid = openGrid()
    expect(canMove(grid, -1, 0)).toBe(false)
  })

  it('returns false when y < 0', () => {
    const grid = openGrid()
    expect(canMove(grid, 0, -1)).toBe(false)
  })

  it('returns false when x >= COLS', () => {
    const grid = openGrid()
    expect(canMove(grid, COLS, 0)).toBe(false)
  })

  it('returns false when y >= ROWS', () => {
    const grid = openGrid()
    expect(canMove(grid, 0, ROWS)).toBe(false)
  })
})

// ── resolvePlayerGhostCollision ────────────────────────────────────────────

describe('resolvePlayerGhostCollision', () => {
  const scared = (x, y) => ({ x, y, scared: true,  scaredTimer: 5000, eaten: false })
  const normal = (x, y) => ({ x, y, scared: false, scaredTimer: 0,    eaten: false })
  const eaten  = (x, y) => ({ x, y, scared: false, scaredTimer: 0,    eaten: true  })
  const player = (x, y) => ({ x, y })

  it('scared ghost on same cell → ghost_eaten', () => {
    expect(resolvePlayerGhostCollision(scared(3, 3), player(3, 3))).toBe('ghost_eaten')
  })

  it('scared ghost on different cell → null', () => {
    expect(resolvePlayerGhostCollision(scared(3, 3), player(4, 3))).toBe(null)
  })

  it('normal ghost on same cell → player_hit', () => {
    expect(resolvePlayerGhostCollision(normal(3, 3), player(3, 3))).toBe('player_hit')
  })

  it('normal ghost on different cell → null', () => {
    expect(resolvePlayerGhostCollision(normal(3, 3), player(3, 4))).toBe(null)
  })

  it('already-eaten ghost on same cell → null', () => {
    expect(resolvePlayerGhostCollision(eaten(3, 3), player(3, 3))).toBe(null)
  })

  it('scared ghost with scaredTimer=1 on same cell → ghost_eaten (timer not yet expired)', () => {
    const g = { x: 5, y: 5, scared: true, scaredTimer: 1, eaten: false }
    expect(resolvePlayerGhostCollision(g, player(5, 5))).toBe('ghost_eaten')
  })
})

// ── bfsStep ────────────────────────────────────────────────────────────────

describe('bfsStep', () => {
  /**
   * 23×23 grid where only row 0 (columns 0–22) is open; everything else is a wall.
   * This gives a horizontal corridor at y=0.
   */
  function corridorGrid() {
    const g = walledGrid()
    for (let c = 0; c < COLS; c++) {
      g[0][c] = 0
    }
    return g
  }

  it('returns {dx:1, dy:0} stepping right along the corridor', () => {
    const grid = corridorGrid()
    expect(bfsStep(grid, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual({ dx: 1, dy: 0 })
  })

  it('returns {dx:-1, dy:0} stepping left along the corridor', () => {
    const grid = corridorGrid()
    expect(bfsStep(grid, { x: 2, y: 0 }, { x: 0, y: 0 })).toEqual({ dx: -1, dy: 0 })
  })

  it('returns {dx:0, dy:0} when already at the destination', () => {
    const grid = corridorGrid()
    expect(bfsStep(grid, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ dx: 0, dy: 0 })
  })

  it('returns {dx:0, dy:0} when there is no path (target is a wall)', () => {
    const grid = corridorGrid()
    // (0,1) is a wall in corridorGrid, so no path from (0,0) to (0,1)
    expect(bfsStep(grid, { x: 0, y: 0 }, { x: 0, y: 1 })).toEqual({ dx: 0, dy: 0 })
  })
})

// ── initGameState ──────────────────────────────────────────────────────────

describe('initGameState', () => {
  const grid = Array.from({ length: 23 }, () => new Array(23).fill(0))
  const playerStart = { x: 1, y: 1 }
  const ghostStarts = [
    { x: 11, y: 11 },
    { x: 10, y: 11 },
    { x: 12, y: 11 },
    { x: 11, y: 10 },
  ]
  const pathCells   = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]
  const powerPellets = [{ x: 1, y: 1 }]
  const ghostHouseCenter = { x: 11, y: 11 }

  const state = initGameState({ grid, playerStart, ghostStarts, pathCells, powerPellets, ghostHouseCenter })

  it('player starts at the correct position', () => {
    expect(state.player.x).toBe(1)
    expect(state.player.y).toBe(1)
  })

  it('creates exactly 4 ghosts', () => {
    expect(state.ghosts).toHaveLength(4)
  })

  it('every ghost has a non-empty name string', () => {
    for (const ghost of state.ghosts) {
      expect(typeof ghost.name).toBe('string')
      expect(ghost.name.length).toBeGreaterThan(0)
    }
  })

  it('pellets is a Set', () => {
    expect(state.pellets).toBeInstanceOf(Set)
  })

  it('powerPellets is a Set', () => {
    expect(state.powerPellets).toBeInstanceOf(Set)
  })

  it('starts with 3 lives', () => {
    expect(state.lives).toBe(3)
  })

  it('phase is "playing"', () => {
    expect(state.phase).toBe('playing')
  })

  it('ghostHouseCenter matches the input', () => {
    expect(state.ghostHouseCenter).toEqual({ x: 11, y: 11 })
  })

  it('every ghost starts with respawnTimer === 0', () => {
    for (const ghost of state.ghosts) {
      expect(ghost.respawnTimer).toBe(0)
    }
  })
})
