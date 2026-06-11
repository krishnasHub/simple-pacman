import React, { useRef, useState, useEffect, useCallback } from 'react'
import { generateMaze } from './maze.js'
import {
  CELL_SIZE,
  COLS,
  ROWS,
  TICK_MS,
  GHOST_TICK_MS,
  SCARED_MS,
  MISSILE_TICK_MS,
  MISSILE_KILL_SCORE,
  canMove,
  getWrappedPosition,
  bfsStep,
  randomStep,
  initGameState,
  resolvePlayerGhostCollision,
  bfsPathLength,
  findNearestAmongCells,
} from './gameEngine.js'

const CS = CELL_SIZE
const CANVAS_W = COLS * CS  // 552
const CANVAS_H = ROWS * CS  // 552

// ---------------------------------------------------------------------------
// Ghost mood definitions
// ---------------------------------------------------------------------------

const MOODS = {
  wandering: {
    label: 'WANDERING',
    color: '#90c9a0',
    phrases: ["Just roaming around...", "Where did they go?", "La la la~", "Nothing to see here"],
  },
  alert: {
    label: 'ON THE HUNT',
    color: '#f7d070',
    phrases: ["I sense something...", "Getting warmer...", "Found a trail!", "Watch out..."],
  },
  furious: {
    label: 'FURIOUS!',
    color: '#ff7070',
    phrases: ["THERE YOU ARE!", "You can't escape!", "COME HERE!", "GOT YOU NOW!"],
  },
  terrified: {
    label: 'TERRIFIED',
    color: '#7b9fff',
    phrases: ["RUN AWAY!", "Oh no oh no...", "Not the power pellet!", "PLEASE STAY BACK!"],
  },
  nervous: {
    label: 'NERVOUS...',
    color: '#ffc4a0',
    phrases: ["Almost safe...", "Hold on...", "Hang in there...", "Nearly recovered..."],
  },
  defeated: {
    label: 'DEFEATED',
    color: '#a0a0c0',
    phrases: ["That hurt...", "I'll be back!", "Teleporting home...", "Regrouping..."],
  },
}

function getMoodFromPanel(g) {
  if (g.eaten) return 'defeated'
  if (g.scared && g.scaredTimer < 3000) return 'nervous'
  if (g.scared) return 'terrified'
  if (g.dist <= 3) return 'furious'
  if (g.dist <= 7) return 'alert'
  return 'wandering'
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

// Portal cells: mid-column on top/bottom border, mid-row on left/right border
function drawMaze(ctx, grid) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col] === 1) {
        ctx.fillStyle = '#1a1a3e'
        ctx.fillRect(col * CS, row * CS, CS, CS)
        ctx.strokeStyle = '#2d2d6e'
        ctx.lineWidth = 0.5
        ctx.strokeRect(col * CS, row * CS, CS, CS)
      } else if (col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1) {
        // Any open border cell is a portal — highlight dynamically
        ctx.fillStyle = 'rgba(100, 220, 210, 0.18)'
        ctx.fillRect(col * CS, row * CS, CS, CS)
        ctx.strokeStyle = '#64dcd2'
        ctx.lineWidth = 1
        ctx.strokeRect(col * CS + 0.5, row * CS + 0.5, CS - 1, CS - 1)
      }
    }
  }
}

function drawPellets(ctx, pellets) {
  ctx.fillStyle = '#c9b8d9'
  for (const key of pellets) {
    const [x, y] = key.split(',').map(Number)
    ctx.beginPath()
    ctx.arc(x * CS + CS / 2, y * CS + CS / 2, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPowerPellets(ctx, powerPellets) {
  const opacity = 0.6 + 0.4 * Math.sin(Date.now() / 300)
  ctx.fillStyle = `rgba(247, 197, 159, ${opacity})`
  for (const key of powerPellets) {
    const [x, y] = key.split(',').map(Number)
    ctx.beginPath()
    ctx.arc(x * CS + CS / 2, y * CS + CS / 2, 6, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawMissilePacks(ctx, missilePacks) {
  for (const key of missilePacks) {
    const [x, y] = key.split(',').map(Number)
    const cx = x * CS + CS / 2
    const cy = y * CS + CS / 2
    ctx.save()
    ctx.shadowBlur = 10
    ctx.shadowColor = '#ff6600'
    ctx.fillStyle = '#ff8c00'
    // Draw a diamond shape
    ctx.beginPath()
    ctx.moveTo(cx, cy - 7)
    ctx.lineTo(cx + 5, cy)
    ctx.lineTo(cx, cy + 7)
    ctx.lineTo(cx - 5, cy)
    ctx.closePath()
    ctx.fill()
    // Inner highlight
    ctx.fillStyle = '#ffcc44'
    ctx.beginPath()
    ctx.moveTo(cx, cy - 4)
    ctx.lineTo(cx + 3, cy)
    ctx.lineTo(cx, cy + 4)
    ctx.lineTo(cx - 3, cy)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

// Change 3 — colour missiles based on firedBy
function drawActiveMissiles(ctx, missiles, canvasW, canvasH) {
  if (missiles.length === 0) return

  // Dim the scene — draw a semi-transparent overlay so missiles stand out
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(0, 0, canvasW, canvasH)

  for (const m of missiles) {
    const cx = m.x * CS + CS / 2
    const cy = m.y * CS + CS / 2
    const isPlayer = m.firedBy === 'player'
    const glowColor  = isPlayer ? '#ffaa00' : '#ff2255'
    const outerColor = isPlayer ? '#ffdd00' : '#ff5577'

    ctx.save()

    // Wide outer halo — three stacked passes for a deep glow
    for (const [blur, radius] of [[40, 12], [22, 8], [10, 6]]) {
      ctx.shadowBlur = blur
      ctx.shadowColor = glowColor
      ctx.fillStyle = outerColor
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Bright core
    ctx.shadowBlur = 6
    ctx.shadowColor = '#ffffff'
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx, cy, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

function drawGhostBody(ctx, cx, cy, radius, fillColor) {
  ctx.fillStyle = fillColor
  ctx.beginPath()
  // Top semicircle
  ctx.arc(cx, cy - radius * 0.1, radius, Math.PI, 0, false)
  // Right side down
  const bottom = cy + radius * 0.9
  ctx.lineTo(cx + radius, bottom)

  // Three bumps along the bottom (using quadratic curves)
  const bumpW = (radius * 2) / 3
  const bumpH = radius * 0.3
  // Bump 3 (right)
  ctx.quadraticCurveTo(
    cx + radius - bumpW * 0.5, bottom + bumpH,
    cx + radius - bumpW, bottom
  )
  // Bump 2 (center)
  ctx.quadraticCurveTo(
    cx + radius - bumpW * 1.5, bottom + bumpH,
    cx + radius - bumpW * 2, bottom
  )
  // Bump 1 (left)
  ctx.quadraticCurveTo(
    cx + radius - bumpW * 2.5, bottom + bumpH,
    cx - radius, bottom
  )
  ctx.closePath()
  ctx.fill()
}

function drawGhostEyes(ctx, cx, cy, radius) {
  const eyeOffsetX = radius * 0.35
  const eyeOffsetY = radius * 0.1
  const eyeRadius = radius * 0.25
  const pupilRadius = radius * 0.12

  // White parts
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(cx - eyeOffsetX, cy - eyeOffsetY, eyeRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + eyeOffsetX, cy - eyeOffsetY, eyeRadius, 0, Math.PI * 2)
  ctx.fill()

  // Dark pupils
  ctx.fillStyle = '#000099'
  ctx.beginPath()
  ctx.arc(cx - eyeOffsetX + pupilRadius, cy - eyeOffsetY + pupilRadius, pupilRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + eyeOffsetX + pupilRadius, cy - eyeOffsetY + pupilRadius, pupilRadius, 0, Math.PI * 2)
  ctx.fill()
}

function drawGhosts(ctx, ghosts) {
  const now = Date.now()
  for (const ghost of ghosts) {
    if (ghost.eaten) continue

    const cx = ghost.x * CS + CS / 2
    const cy = ghost.y * CS + CS / 2
    const radius = CS / 2 - 1

    let fillColor
    if (ghost.scared) {
      if (ghost.scaredTimer < 2000) {
        // Flashing between soft blue and light lavender
        fillColor = Math.floor(now / 300) % 2 === 0 ? '#7b9fff' : '#e8e0f0'
      } else {
        fillColor = '#7b9fff'
      }
    } else {
      fillColor = ghost.color
    }

    drawGhostBody(ctx, cx, cy, radius, fillColor)

    if (!ghost.scared) {
      drawGhostEyes(ctx, cx, cy, radius)
    }
  }
}

function drawPlayer(ctx, player, phase) {
  if (phase === 'dying') {
    // Blink effect during dying phase
    if (Date.now() % 300 < 150) return
  }

  const cx = player.x * CS + CS / 2
  const cy = player.y * CS + CS / 2
  const radius = CS / 2 - 2

  // Facing angle based on direction
  let facingAngle = 0
  const { dx, dy } = player.dir
  if (dx === 1) facingAngle = 0
  else if (dx === -1) facingAngle = Math.PI
  else if (dy === -1) facingAngle = -Math.PI / 2
  else if (dy === 1) facingAngle = Math.PI / 2

  const mouthGap = player.mouthAngle * Math.PI

  ctx.fillStyle = '#f9e05d'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, radius, facingAngle + mouthGap, facingAngle - mouthGap + Math.PI * 2, false)
  ctx.closePath()
  ctx.fill()
}

// ---------------------------------------------------------------------------
// Missile pack respawn — called every 2 minutes while playing
// ---------------------------------------------------------------------------

function respawnMissilePacks(state) {
  state.missilePacks.clear()
  const { grid, player } = state
  const pathCells = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === 0) pathCells.push({ x: c, y: r })
    }
  }
  const inGhostHouse = (x, y) => x >= 9 && x <= 13 && y >= 8 && y <= 12
  const isBorder = (x, y) => x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1
  const eligible = pathCells.filter(c =>
    !inGhostHouse(c.x, c.y) &&
    !isBorder(c.x, c.y) &&
    Math.abs(c.x - player.x) + Math.abs(c.y - player.y) > 2
  )
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]]
  }
  const centerDist = c => Math.abs(c.x - 11) + Math.abs(c.y - 11)
  const inner = eligible.filter(c => centerDist(c) <= 7).slice(0, 6)
  const outer = eligible.filter(c => centerDist(c) > 7).slice(0, 3)
  for (const c of [...inner, ...outer]) state.missilePacks.add(`${c.x},${c.y}`)
}

// ---------------------------------------------------------------------------
// Ghost persona helpers (module-level, before renderFrame)
// ---------------------------------------------------------------------------

// Returns {dx,dy} if player is in same row or column (used for aiming)
function lineOfSightDir(from, to) {
  if (from.x === to.x && from.y !== to.y) return { dx: 0, dy: to.y > from.y ? 1 : -1 }
  if (from.y === to.y && from.x !== to.x) return { dx: to.x > from.x ? 1 : -1, dy: 0 }
  return null
}

// BLAZE (0) — pure aggressive BFS, always fastest path
function blazeMove(grid, ghost, player) {
  return bfsStep(grid, ghost, player)
}

// NIMBUS (1) — lingers near pickups, ambushes player
function nimbusMove(grid, ghost, player, missilePacks, powerPellets) {
  const allPickups = new Set([...missilePacks, ...powerPellets])
  const nearest = findNearestAmongCells(grid, ghost, allPickups)
  if (nearest) {
    const distToPickup = Math.abs(ghost.x - nearest.x) + Math.abs(ghost.y - nearest.y)
    const distToPlayer = Math.abs(ghost.x - player.x) + Math.abs(ghost.y - player.y)
    // Patrol near the pickup if player is not close yet
    if (distToPickup <= 5 && distToPlayer > 5) {
      const step = bfsStep(grid, ghost, nearest)
      if (step.dx !== 0 || step.dy !== 0) return step
    }
  }
  return bfsStep(grid, ghost, player)
}

// GLITCH (2) — random chaos with 35% directional pull toward player
function glitchMove(grid, ghost, player) {
  if (Math.random() < 0.35) {
    const step = bfsStep(grid, ghost, player)
    if (step.dx !== 0 || step.dy !== 0) return step
  }
  return randomStep(grid, ghost, ghost.dir)
}

// DUSK (3) — coordinator: positions itself opposite the centroid of other ghosts
// relative to the player, creating a pincer movement
function duskMove(grid, ghost, player, ghosts) {
  const others = ghosts.filter((g, i) => i !== 3 && !g.eaten)
  if (others.length === 0) return bfsStep(grid, ghost, player)

  const cx = others.reduce((s, g) => s + g.x, 0) / others.length
  const cy = others.reduce((s, g) => s + g.y, 0) / others.length

  // Vector from centroid toward player; Dusk goes beyond the player on that vector
  const dvx = player.x - cx
  const dvy = player.y - cy
  const mag = Math.sqrt(dvx * dvx + dvy * dvy) || 1
  const targetX = Math.round(Math.max(1, Math.min(COLS - 2, player.x + (dvx / mag) * 4)))
  const targetY = Math.round(Math.max(1, Math.min(ROWS - 2, player.y + (dvy / mag) * 4)))

  const step = bfsStep(grid, ghost, { x: targetX, y: targetY })
  if (step.dx !== 0 || step.dy !== 0) return step
  return bfsStep(grid, ghost, player)
}

// ---- Ghost missile-firing decisions (returns {dx,dy} to fire, or null) ----

// Returns the adjacent wall direction that most reduces BFS distance from `ghost` to `target`.
// Only fires when the path is longer than `threshold` and a wall break saves >= `minGain` steps.
function bestShortcutDir(ghost, target, grid, threshold, minGain) {
  const currentDist = bfsPathLength(grid, ghost, target)
  if (currentDist <= threshold) return null
  const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]
  let bestDir = null
  let bestGain = minGain
  for (const d of dirs) {
    const wx = ghost.x + d.dx
    const wy = ghost.y + d.dy
    if (wx < 0 || wx >= COLS || wy < 0 || wy >= ROWS || grid[wy][wx] !== 1) continue
    grid[wy][wx] = 0
    const newDist = bfsPathLength(grid, ghost, target)
    grid[wy][wx] = 1
    const gain = currentDist - newDist
    if (gain > bestGain) { bestGain = gain; bestDir = d }
  }
  return bestDir
}

function blazeFire(ghost, player, grid) {
  // Only fire to carve a shortcut toward the player when the path is long
  const dir = bestShortcutDir(ghost, player, grid, 6, 2)
  return dir && Math.random() < 0.6 ? dir : null
}

function nimbusFire(ghost, grid, missilePacks, powerPellets) {
  // Fire to carve a shortcut toward the nearest pickup (power pellet or missile pack)
  const allPickups = new Set([...missilePacks, ...powerPellets])
  const nearest = findNearestAmongCells(grid, ghost, allPickups)
  if (!nearest) return null
  const dir = bestShortcutDir(ghost, nearest, grid, 5, 2)
  return dir && Math.random() < 0.55 ? dir : null
}

function glitchFire(ghost, grid) {
  // Random chance — fire into a random adjacent wall to create chaos
  if (Math.random() < 0.06) {
    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]
    const wallDirs = dirs.filter(d => {
      const wx = ghost.x + d.dx; const wy = ghost.y + d.dy
      return wx >= 0 && wx < COLS && wy >= 0 && wy < ROWS && grid[wy][wx] === 1
    })
    if (wallDirs.length > 0) return wallDirs[Math.floor(Math.random() * wallDirs.length)]
  }
  return null
}

function duskFire(ghost, player, grid, ghosts) {
  const others = ghosts.filter((g, i) => i !== 3 && !g.eaten)
  if (others.length === 0) return null

  const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]
  let bestDir = null
  let bestGain = 2

  for (const d of dirs) {
    const wx = ghost.x + d.dx
    const wy = ghost.y + d.dy
    if (wx < 0 || wx >= COLS || wy < 0 || wy >= ROWS || grid[wy][wx] !== 1) continue

    // Measure average BFS path length BEFORE breaking the wall
    const avgBefore = others.reduce((s, g) => s + bfsPathLength(grid, g, player), 0) / others.length

    // Break temporarily
    grid[wy][wx] = 0
    const avgAfter = others.reduce((s, g) => s + bfsPathLength(grid, g, player), 0) / others.length
    grid[wy][wx] = 1  // restore

    const gain = avgBefore - avgAfter  // positive = breaking this wall helps others
    if (gain > bestGain) {
      bestGain = gain
      bestDir = d
    }
  }

  return bestDir && Math.random() < 0.7 ? bestDir : null
}

// ---------------------------------------------------------------------------
// Render frame
// ---------------------------------------------------------------------------

function renderFrame(canvas, state) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  // Dark background
  ctx.fillStyle = '#0d0d1a'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  drawMaze(ctx, state.grid)
  drawPellets(ctx, state.pellets)
  drawPowerPellets(ctx, state.powerPellets)
  drawMissilePacks(ctx, state.missilePacks)
  drawGhosts(ctx, state.ghosts)
  drawPlayer(ctx, state.player, state.phase)
  // Missiles drawn last: dim overlay + bright glow renders on top of everything
  drawActiveMissiles(ctx, state.activeMissiles, CANVAS_W, CANVAS_H)
}

// ---------------------------------------------------------------------------
// Game component
// ---------------------------------------------------------------------------

export default function Game() {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const mazeDataRef = useRef(null)
  const pendingDirRef = useRef({ dx: 0, dy: 0, pending: false })
  const heldDirRef = useRef(null)
  const rafRef = useRef(null)

  const lastPlayerTickRef = useRef(0)
  const lastGhostTickRef = useRef(0)
  const lastMissileTickRef = useRef(0)
  const lastMissilePackSpawnRef = useRef(0)
  const lastUiRef = useRef({ score: 0, lives: 3, phase: 'playing', missiles: 1 })

  const [ui, setUi] = useState({ score: 0, lives: 3, phase: 'playing', missiles: 1 })
  const [ghostPanel, setGhostPanel] = useState([])
  const [phraseIdx, setPhraseIdx] = useState(0)

  const startGame = useCallback(() => {
    const mazeData = generateMaze(COLS, ROWS)
    mazeDataRef.current = mazeData
    const state = initGameState(mazeData)

    // Remove player's starting cell pellet so it doesn't immediately collect
    const playerKey = `${state.player.x},${state.player.y}`
    state.pellets.delete(playerKey)
    state.powerPellets.delete(playerKey)
    state.missilePacks.delete(playerKey)

    stateRef.current = state
    pendingDirRef.current = { dx: 0, dy: 0, pending: false }
    lastPlayerTickRef.current = 0
    lastGhostTickRef.current = 0
    lastMissileTickRef.current = 0
    lastMissilePackSpawnRef.current = performance.now()

    const initialUi = { score: 0, lives: 3, phase: 'playing', missiles: 3 }
    lastUiRef.current = initialUi
    setUi(initialUi)
  }, [])

  const restartGame = useCallback(() => {
    startGame()
  }, [startGame])

  // Ghost panel update every 500ms
  // Change 7 — add missiles to each ghost snapshot
  useEffect(() => {
    const id = setInterval(() => {
      if (!stateRef.current) return
      const { ghosts, player } = stateRef.current
      setGhostPanel(ghosts.map(g => ({
        name: g.name,
        color: g.color,
        scared: g.scared,
        scaredTimer: g.scaredTimer,
        eaten: g.eaten,
        dist: Math.abs(g.x - player.x) + Math.abs(g.y - player.y),
        missiles: g.missiles,
      })))
    }, 500)
    return () => clearInterval(id)
  }, [])

  // Cycle phrase index every 3s
  useEffect(() => {
    const id = setInterval(() => setPhraseIdx(i => i + 1), 3000)
    return () => clearInterval(id)
  }, [])

  // Main game loop
  useEffect(() => {
    let prevTimestamp = null

    function loop(timestamp) {
      if (!stateRef.current || !canvasRef.current) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      if (prevTimestamp === null) prevTimestamp = timestamp
      const elapsed = timestamp - prevTimestamp
      prevTimestamp = timestamp

      const state = stateRef.current

      // ---- Dying phase ----
      if (state.phase === 'dying') {
        state.dyingTimer -= elapsed
        if (state.dyingTimer <= 0) {
          // Persistent state: keep the grid (broken walls stay), pellets eaten stay eaten,
          // missile packs collected stay collected. Only reset player and ghosts.

          // Reset player to original spawn position
          state.player.x = mazeDataRef.current.playerStart.x
          state.player.y = mazeDataRef.current.playerStart.y
          state.player.dir = { dx: 1, dy: 0 }
          state.player.mouthAngle = 0.25
          state.player.mouthOpen = true
          // Keep player.missiles as-is
          pendingDirRef.current = { dx: 0, dy: 0, pending: false }

          // Clear any in-flight missiles
          state.activeMissiles = []

          // Return all ghosts to ghost house
          // Change 6 — only reset position/state, NOT missiles or missileCooldown
          const ghostSlots = [
            { x: 10, y: 11 }, { x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 10 },
          ]
          state.ghosts.forEach((ghost, i) => {
            const slot = ghostSlots[i % ghostSlots.length]
            ghost.x = slot.x
            ghost.y = slot.y
            ghost.scared = false
            ghost.scaredTimer = 0
            ghost.eaten = false
            ghost.respawnTimer = 0
            ghost.dir = { dx: 0, dy: 0 }
            // ghost.missiles and ghost.missileCooldown intentionally NOT reset
          })

          state.phase = 'playing'
          lastPlayerTickRef.current = timestamp
          lastGhostTickRef.current = timestamp
        }
        renderFrame(canvasRef.current, state)
        // Update React UI so the dying overlay can render
        const dyingPrev = lastUiRef.current
        if (
          dyingPrev.phase !== 'dying' ||
          dyingPrev.lives !== state.lives ||
          dyingPrev.missiles !== state.player.missiles
        ) {
          const next = { score: state.score, lives: state.lives, phase: 'dying', missiles: state.player.missiles }
          lastUiRef.current = next
          setUi(next)
        }
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // ---- Won phase — auto-restart ----
      if (state.phase === 'won') {
        state.winTimer -= elapsed
        if (state.winTimer <= 0) {
          restartGame()
          rafRef.current = requestAnimationFrame(loop)
          return
        }
        // Render and show overlay while waiting
        renderFrame(canvasRef.current, state)
        const prev = lastUiRef.current
        if (
          prev.phase !== state.phase ||
          prev.score !== state.score ||
          prev.lives !== state.lives ||
          prev.missiles !== state.player.missiles
        ) {
          const next = { score: state.score, lives: state.lives, phase: state.phase, missiles: state.player.missiles }
          lastUiRef.current = next
          setUi(next)
        }
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // ---- Non-playing phases (gameover) ----
      if (state.phase !== 'playing') {
        renderFrame(canvasRef.current, state)
        const prev = lastUiRef.current
        if (
          prev.phase !== state.phase ||
          prev.score !== state.score ||
          prev.lives !== state.lives ||
          prev.missiles !== state.player.missiles
        ) {
          const next = { score: state.score, lives: state.lives, phase: state.phase, missiles: state.player.missiles }
          lastUiRef.current = next
          setUi(next)
        }
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // ---- Missile pack respawn (every 2 minutes) ----
      if (timestamp - lastMissilePackSpawnRef.current >= 30_000) {
        lastMissilePackSpawnRef.current = timestamp
        respawnMissilePacks(state)
      }

      // ---- Player tick ----
      if (timestamp - lastPlayerTickRef.current >= TICK_MS) {
        lastPlayerTickRef.current = timestamp

        const { player, grid, pellets, powerPellets, ghosts } = state

        // Feed held direction into pending each tick for continuous movement
        if (!pendingDirRef.current.pending && heldDirRef.current) {
          pendingDirRef.current = { ...heldDirRef.current, pending: true }
        }

        const pd = pendingDirRef.current
        if (pd.pending) {
          pd.pending = false
          const playerDest = getWrappedPosition(grid, player.x, player.y, pd.dx, pd.dy)
          if (playerDest) {
            player.x = playerDest.x
            player.y = playerDest.y
            player.dir = { dx: pd.dx, dy: pd.dy }

            // Check if the player walked onto any ghost
            for (const ghost of ghosts) {
              const hit = resolvePlayerGhostCollision(ghost, player)
              if (hit === 'ghost_eaten') {
                ghost.eaten = true
                ghost.respawnTimer = 3000
                ghost.scared = false
                ghost.scaredTimer = 0
                state.score += 200
              } else if (hit === 'player_hit') {
                state.lives -= 1
                if (state.lives <= 0) state.phase = 'gameover'
                else { state.phase = 'dying'; state.dyingTimer = 1500 }
                break
              }
            }
          }
          // Animate mouth even on failed move attempt
          player.mouthAngle = player.mouthOpen ? 0.25 : 0.05
          player.mouthOpen = !player.mouthOpen
        }
        // NO fallthrough movement — player stays still if no pending move

        // Pellet collection
        const key = `${player.x},${player.y}`
        if (pellets.has(key)) {
          pellets.delete(key)
          state.score += 10
        }
        if (powerPellets.has(key)) {
          powerPellets.delete(key)
          state.score += 50
          // Scare all non-eaten ghosts
          for (const ghost of ghosts) {
            if (!ghost.eaten) {
              ghost.scared = true
              ghost.scaredTimer = SCARED_MS
            }
          }
        }

        // Missile pickup
        const mKey = `${player.x},${player.y}`
        if (state.missilePacks.has(mKey)) {
          state.missilePacks.delete(mKey)
          player.missiles += 1
          state.score += 25
        }

        // Win check
        if (pellets.size === 0 && powerPellets.size === 0) {
          state.phase = 'won'
          state.winTimer = 2500
        }
      }

      // ---- Ghost tick ----
      // Change 5 — persona movement + ghost missile firing
      if (timestamp - lastGhostTickRef.current >= GHOST_TICK_MS) {
        lastGhostTickRef.current = timestamp
        const { player, grid, ghosts, missilePacks, powerPellets } = state

        for (let i = 0; i < ghosts.length; i++) {
          const ghost = ghosts[i]

          // ---- Eaten / respawning ----
          if (ghost.eaten) {
            ghost.respawnTimer -= GHOST_TICK_MS
            if (ghost.respawnTimer <= 0) {
              ghost.x = state.ghostHouseCenter.x
              ghost.y = state.ghostHouseCenter.y
              ghost.eaten = false
              ghost.scared = false
              ghost.scaredTimer = 0
              ghost.dir = { dx: 0, dy: -1 }
              // missiles and missileCooldown intentionally NOT reset
            }
            continue
          }

          // ---- Missile cooldown tick ----
          if (ghost.missileCooldown > 0) ghost.missileCooldown--

          // ---- Persona movement ----
          let nextDir
          if (ghost.scared) {
            nextDir = randomStep(grid, ghost, ghost.dir)
          } else {
            switch (i) {
              case 0: nextDir = blazeMove(grid, ghost, player); break
              case 1: nextDir = nimbusMove(grid, ghost, player, missilePacks, powerPellets); break
              case 2: nextDir = glitchMove(grid, ghost, player); break
              case 3: nextDir = duskMove(grid, ghost, player, ghosts); break
              default: nextDir = randomStep(grid, ghost, ghost.dir)
            }
            if (!nextDir || (nextDir.dx === 0 && nextDir.dy === 0)) {
              nextDir = randomStep(grid, ghost, ghost.dir)
            }
          }

          // ---- Ghost missile firing (before moving, only when not scared) ----
          if (!ghost.scared && ghost.missiles > 0 && ghost.missileCooldown === 0) {
            let fireDir = null
            switch (i) {
              case 0: fireDir = blazeFire(ghost, player, grid); break
              case 1: fireDir = nimbusFire(ghost, grid, missilePacks, powerPellets); break
              case 2: fireDir = glitchFire(ghost, grid); break
              case 3: fireDir = duskFire(ghost, player, grid, ghosts); break
            }
            if (fireDir) {
              state.activeMissiles.push({ x: ghost.x, y: ghost.y, dx: fireDir.dx, dy: fireDir.dy, firedBy: i, born: timestamp })
              ghost.missiles -= 1
              ghost.missileCooldown = 10  // ~3.6s before next shot
            }
          }

          // ---- Move ghost ----
          ghost.dir = nextDir
          const ghostDest = getWrappedPosition(grid, ghost.x, ghost.y, nextDir.dx, nextDir.dy)
          if (ghostDest) {
            ghost.x = ghostDest.x
            ghost.y = ghostDest.y
          }

          // ---- Collision with player (before scared timer tick) ----
          const hit = resolvePlayerGhostCollision(ghost, player)
          if (hit === 'ghost_eaten') {
            ghost.eaten = true
            ghost.respawnTimer = 3000
            ghost.scared = false
            ghost.scaredTimer = 0
            state.score += 200
          } else if (hit === 'player_hit') {
            state.lives -= 1
            if (state.lives <= 0) state.phase = 'gameover'
            else { state.phase = 'dying'; state.dyingTimer = 1500 }
            break
          }

          // ---- Scared timer (after collision) ----
          if (ghost.scared) {
            ghost.scaredTimer -= GHOST_TICK_MS
            if (ghost.scaredTimer <= 0) {
              ghost.scared = false
              ghost.scaredTimer = 0
            }
          }
        }
      }

      // ---- Missile tick ----
      // Change 2 — collision respects firedBy
      if (state.activeMissiles.length > 0 && timestamp - lastMissileTickRef.current >= MISSILE_TICK_MS) {
        lastMissileTickRef.current = timestamp
        const { grid, ghosts, player, activeMissiles } = state

        for (let i = activeMissiles.length - 1; i >= 0; i--) {
          const m = activeMissiles[i]

          // Expire after 10 seconds
          if (timestamp - m.born >= 10_000) { activeMissiles.splice(i, 1); continue }

          // Try to advance the missile one cell
          const dest = getWrappedPosition(grid, m.x, m.y, m.dx, m.dy)

          if (dest === null) {
            // Compute the target cell, wrapping if missile is at a border
            const rawWx = m.x + m.dx
            const rawWy = m.y + m.dy
            const wallX = rawWx < 0 ? COLS - 1 : rawWx >= COLS ? 0 : rawWx
            const wallY = rawWy < 0 ? ROWS - 1 : rawWy >= ROWS ? 0 : rawWy
            if (grid[wallY][wallX] === 1) {
              grid[wallY][wallX] = 0
              // Border hit — open the mirrored cell to create a portal pair
              if (wallX === 0) grid[wallY][COLS - 1] = 0
              else if (wallX === COLS - 1) grid[wallY][0] = 0
              else if (wallY === 0) grid[ROWS - 1][wallX] = 0
              else if (wallY === ROWS - 1) grid[0][wallX] = 0
            }
            activeMissiles.splice(i, 1)
            continue
          }

          // Move missile to destination
          m.x = dest.x
          m.y = dest.y

          let hitSomething = false

          // Ghost hit — only player missiles kill ghosts
          if (m.firedBy === 'player') {
            for (const ghost of ghosts) {
              if (!ghost.eaten && ghost.x === m.x && ghost.y === m.y) {
                ghost.eaten = true
                ghost.respawnTimer = 3000
                ghost.scared = false
                ghost.scaredTimer = 0
                state.score += MISSILE_KILL_SCORE
                hitSomething = true
                break
              }
            }
          }

          // Ghost missiles pass through the player — they only break walls

          if (hitSomething) {
            activeMissiles.splice(i, 1)
          }
        }
      }

      // ---- Update React UI (guarded) ----
      const prev = lastUiRef.current
      if (
        prev.score !== state.score ||
        prev.lives !== state.lives ||
        prev.phase !== state.phase ||
        prev.missiles !== state.player.missiles
      ) {
        const next = { score: state.score, lives: state.lives, phase: state.phase, missiles: state.player.missiles }
        lastUiRef.current = next
        setUi(next)
      }

      renderFrame(canvasRef.current, state)
      rafRef.current = requestAnimationFrame(loop)
    }

    startGame()
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [startGame, restartGame])

  // Keyboard handler — continuous movement while key held, one-step on tap
  useEffect(() => {
    function dirFromKey(key) {
      switch (key) {
        case 'ArrowUp':    case 'w': case 'W': return { dx: 0,  dy: -1 }
        case 'ArrowDown':  case 's': case 'S': return { dx: 0,  dy:  1 }
        case 'ArrowLeft':  case 'a': case 'A': return { dx: -1, dy:  0 }
        case 'ArrowRight': case 'd': case 'D': return { dx:  1, dy:  0 }
        default: return null
      }
    }

    function handleKeyDown(e) {
      const dir = dirFromKey(e.key)
      if (dir) {
        e.preventDefault()
        heldDirRef.current = dir
        if (!e.repeat) pendingDirRef.current = { ...dir, pending: true }
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (stateRef.current && stateRef.current.phase === 'playing') {
          const s = stateRef.current
          const { player } = s
          if (player.missiles > 0 && (player.dir.dx !== 0 || player.dir.dy !== 0)) {
            s.activeMissiles.push({ x: player.x, y: player.y, dx: player.dir.dx, dy: player.dir.dy, firedBy: 'player', born: performance.now() })
            player.missiles -= 1
          }
        }
      }
    }

    function handleKeyUp(e) {
      const dir = dirFromKey(e.key)
      if (dir && heldDirRef.current &&
          dir.dx === heldDirRef.current.dx && dir.dy === heldDirRef.current.dy) {
        heldDirRef.current = null
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <div className="game-layout">
      <div className="game-wrapper">
        <div className="game-ui">
          <div>SCORE: {ui.score}</div>
          <div className="missile-count">
            <span className="missile-icon">◆</span> {ui.missiles}
          </div>
          <div className="lives">
            {Array.from({ length: ui.lives }).map((_, i) => (
              <span key={i}>&#9679;</span>
            ))}
          </div>
        </div>

        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />

        {ui.phase === 'dying' && (
          <div className="overlay overlay-dying">
            <h2>LIFE LOST!</h2>
            <div className="lives-display">
              {Array.from({ length: ui.lives }).map((_, i) => (
                <span key={i}>&#9679;</span>
              ))}
            </div>
            <p>{ui.lives} {ui.lives === 1 ? 'life' : 'lives'} remaining</p>
          </div>
        )}

        {ui.phase === 'won' && (
          <div className="overlay">
            <h1>YOU WIN!</h1>
            <p>Score: {ui.score}</p>
            <p style={{ fontSize: '8px', color: '#c9b8d9' }}>New map incoming...</p>
            <button onClick={restartGame}>Play Again</button>
          </div>
        )}

        {ui.phase === 'gameover' && (
          <div className="overlay">
            <h1>GAME OVER</h1>
            <p>Score: {ui.score}</p>
            <button onClick={restartGame}>Try Again</button>
          </div>
        )}
      </div>

      <div className="ghost-panel">
        {ghostPanel.map((g, i) => {
          const mood = getMoodFromPanel(g)
          const moodData = MOODS[mood]
          const phrase = moodData.phrases[phraseIdx % moodData.phrases.length]
          return (
            <div key={i} className="ghost-card">
              <div className="ghost-card-header">
                <div className="ghost-dot" style={{ background: g.color }} />
                <span className="ghost-name">{g.name}</span>
              </div>
              <div className="ghost-mood" style={{ color: moodData.color }}>{moodData.label}</div>
              <div className="ghost-phrase">"{phrase}"</div>
              {/* Change 7 — ghost ammo display */}
              <div className="ghost-ammo">
                {[0, 1, 2].map(j => (
                  <span key={j} style={{ color: j < g.missiles ? '#ff8c00' : '#2a2a4a' }}>◆</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
