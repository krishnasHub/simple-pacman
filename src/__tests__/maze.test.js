import { describe, it, expect } from 'vitest'
import { generateMaze } from '../maze.js'

// Run once; individual tests below inspect the result.
const result = generateMaze()

describe('generateMaze', () => {
  it('grid has 23 rows', () => {
    expect(result.grid).toHaveLength(23)
  })

  it('every row has 23 columns', () => {
    for (const row of result.grid) {
      expect(row).toHaveLength(23)
    }
  })

  it('playerStart is on a path cell (grid value === 0)', () => {
    const { grid, playerStart } = result
    expect(grid[playerStart.y][playerStart.x]).toBe(0)
  })

  it('playerStart is NOT inside the ghost house area', () => {
    const { playerStart } = result
    const inGhostHouse =
      playerStart.x >= 9 && playerStart.x <= 13 &&
      playerStart.y >= 8 && playerStart.y <= 12
    expect(inGhostHouse).toBe(false)
  })

  it('ghostHouseCenter is { x: 11, y: 11 }', () => {
    expect(result.ghostHouseCenter).toEqual({ x: 11, y: 11 })
  })

  it('ghost house center cell is open (grid[11][11] === 0)', () => {
    expect(result.grid[11][11]).toBe(0)
  })

  it('ghostStarts has 4 entries', () => {
    expect(result.ghostStarts).toHaveLength(4)
  })

  it('each ghost start has x and y within [0..22]', () => {
    for (const gs of result.ghostStarts) {
      expect(gs.x).toBeGreaterThanOrEqual(0)
      expect(gs.x).toBeLessThanOrEqual(22)
      expect(gs.y).toBeGreaterThanOrEqual(0)
      expect(gs.y).toBeLessThanOrEqual(22)
    }
  })

  it('pathCells is a non-empty array', () => {
    expect(Array.isArray(result.pathCells)).toBe(true)
    expect(result.pathCells.length).toBeGreaterThan(0)
  })

  it('powerPellets is a non-empty array with at most 4 entries', () => {
    expect(Array.isArray(result.powerPellets)).toBe(true)
    expect(result.powerPellets.length).toBeGreaterThan(0)
    expect(result.powerPellets.length).toBeLessThanOrEqual(4)
  })

  it('no power pellet is inside the ghost house area', () => {
    for (const p of result.powerPellets) {
      const inGhostHouse =
        p.x >= 9 && p.x <= 13 &&
        p.y >= 8 && p.y <= 12
      expect(inGhostHouse).toBe(false)
    }
  })

  it('playerStart is outside the ghost house area across 5 independent runs', () => {
    for (let i = 0; i < 5; i++) {
      const { playerStart } = generateMaze()
      const inGhostHouse =
        playerStart.x >= 9 && playerStart.x <= 13 &&
        playerStart.y >= 8 && playerStart.y <= 12
      expect(inGhostHouse).toBe(false)
    }
  })
})
