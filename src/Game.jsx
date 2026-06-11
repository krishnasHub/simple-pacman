import React, { useRef, useState, useEffect, useCallback } from 'react'
import { generateMaze } from './maze.js'
import {
  CELL_SIZE,
  COLS,
  ROWS,
  TICK_MS,
  GHOST_TICK_MS,
  SCARED_MS,
  canMove,
  getWrappedPosition,
  bfsStep,
  randomStep,
  initGameState,
  resolvePlayerGhostCollision,
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
const PORTAL_CELLS = new Set(['11,0', '11,22', '0,11', '22,11'])

function drawMaze(ctx, grid) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col] === 1) {
        ctx.fillStyle = '#1a1a3e'
        ctx.fillRect(col * CS, row * CS, CS, CS)
        ctx.strokeStyle = '#2d2d6e'
        ctx.lineWidth = 0.5
        ctx.strokeRect(col * CS, row * CS, CS, CS)
      } else if (PORTAL_CELLS.has(`${col},${row}`)) {
        // Highlight portal cells with a subtle teal glow
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

function renderFrame(canvas, state) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  // Dark background
  ctx.fillStyle = '#0d0d1a'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  drawMaze(ctx, state.grid)
  drawPellets(ctx, state.pellets)
  drawPowerPellets(ctx, state.powerPellets)
  drawGhosts(ctx, state.ghosts)
  drawPlayer(ctx, state.player, state.phase)
}

// ---------------------------------------------------------------------------
// Game component
// ---------------------------------------------------------------------------

export default function Game() {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const mazeDataRef = useRef(null)
  const pendingDirRef = useRef({ dx: 0, dy: 0, pending: false })
  const rafRef = useRef(null)

  const lastPlayerTickRef = useRef(0)
  const lastGhostTickRef = useRef(0)
  const lastUiRef = useRef({ score: 0, lives: 3, phase: 'playing' })

  const [ui, setUi] = useState({ score: 0, lives: 3, phase: 'playing' })
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

    stateRef.current = state
    pendingDirRef.current = { dx: 0, dy: 0, pending: false }
    lastPlayerTickRef.current = 0
    lastGhostTickRef.current = 0

    const initialUi = { score: 0, lives: 3, phase: 'playing' }
    lastUiRef.current = initialUi
    setUi(initialUi)
  }, [])

  const restartGame = useCallback(() => {
    startGame()
  }, [startGame])

  // Ghost panel update every 500ms
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
          // Reset to the same map: restore all pellets, return player and ghosts to start
          const mazeData = mazeDataRef.current
          const fresh = initGameState(mazeData)

          // Restore pellets (all of them, minus the player's original start cell)
          const playerKey = `${mazeData.playerStart.x},${mazeData.playerStart.y}`
          fresh.pellets.delete(playerKey)
          fresh.powerPellets.delete(playerKey)
          state.pellets = fresh.pellets
          state.powerPellets = fresh.powerPellets

          // Return player to original spawn
          state.player.x = mazeData.playerStart.x
          state.player.y = mazeData.playerStart.y
          state.player.dir = { dx: 1, dy: 0 }
          state.player.mouthAngle = 0.25
          state.player.mouthOpen = true
          pendingDirRef.current = { dx: 0, dy: 0, pending: false }

          // Return all ghosts to ghost house
          const ghostStarts = [
            { x: 10, y: 11 }, { x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 10 },
          ]
          state.ghosts.forEach((ghost, i) => {
            const slot = ghostStarts[i % ghostStarts.length]
            ghost.x = slot.x
            ghost.y = slot.y
            ghost.scared = false
            ghost.scaredTimer = 0
            ghost.eaten = false
            ghost.respawnTimer = 0
            ghost.dir = { dx: 0, dy: 0 }
          })

          state.phase = 'playing'
          lastPlayerTickRef.current = timestamp
          lastGhostTickRef.current = timestamp
        }
        renderFrame(canvasRef.current, state)
        // Update React UI so the dying overlay can render
        const dyingPrev = lastUiRef.current
        if (dyingPrev.phase !== 'dying' || dyingPrev.lives !== state.lives) {
          const next = { score: state.score, lives: state.lives, phase: 'dying' }
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
        if (prev.phase !== state.phase || prev.score !== state.score || prev.lives !== state.lives) {
          const next = { score: state.score, lives: state.lives, phase: state.phase }
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
        if (prev.phase !== state.phase || prev.score !== state.score || prev.lives !== state.lives) {
          const next = { score: state.score, lives: state.lives, phase: state.phase }
          lastUiRef.current = next
          setUi(next)
        }
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      // ---- Player tick ----
      if (timestamp - lastPlayerTickRef.current >= TICK_MS) {
        lastPlayerTickRef.current = timestamp

        const { player, grid, pellets, powerPellets, ghosts } = state

        // Consume pending move — one step per keypress, no auto-continuation
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

        // Win check
        if (pellets.size === 0 && powerPellets.size === 0) {
          state.phase = 'won'
          state.winTimer = 2500
        }
      }

      // ---- Ghost tick ----
      if (timestamp - lastGhostTickRef.current >= GHOST_TICK_MS) {
        lastGhostTickRef.current = timestamp

        const { player, grid, ghosts } = state

        for (let i = 0; i < ghosts.length; i++) {
          const ghost = ghosts[i]

          // Handle eaten/respawning ghost
          if (ghost.eaten) {
            ghost.respawnTimer -= GHOST_TICK_MS
            if (ghost.respawnTimer <= 0) {
              // Teleport back to ghost house
              ghost.x = state.ghostHouseCenter.x
              ghost.y = state.ghostHouseCenter.y
              ghost.eaten = false
              ghost.scared = false
              ghost.scaredTimer = 0
              ghost.dir = { dx: 0, dy: -1 }  // exit upward
            }
            continue  // skip movement while respawning
          }

          // Ghost AI
          let nextDir
          if (!ghost.scared && i < 2) {
            // Chase mode: BFS toward player
            nextDir = bfsStep(grid, { x: ghost.x, y: ghost.y }, { x: player.x, y: player.y })
            // If BFS returns (0,0) (stuck/same cell), fall back to random
            if (nextDir.dx === 0 && nextDir.dy === 0) {
              nextDir = randomStep(grid, { x: ghost.x, y: ghost.y }, ghost.dir)
            }
          } else {
            // Random mode (also used when scared)
            nextDir = randomStep(grid, { x: ghost.x, y: ghost.y }, ghost.dir)
          }

          ghost.dir = nextDir

          const ghostDest = getWrappedPosition(grid, ghost.x, ghost.y, nextDir.dx, nextDir.dy)
          if (ghostDest) {
            ghost.x = ghostDest.x
            ghost.y = ghostDest.y
          }

          // Collision check — uses ghost.scared value from START of this tick,
          // before any timer decrement, so the power-up outcome is always fair.
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

          // Decrement scared timer AFTER collision is resolved (takes effect next tick)
          if (ghost.scared) {
            ghost.scaredTimer -= GHOST_TICK_MS
            if (ghost.scaredTimer <= 0) {
              ghost.scared = false
              ghost.scaredTimer = 0
            }
          }
        }
      }

      // ---- Update React UI (guarded) ----
      const prev = lastUiRef.current
      if (
        prev.score !== state.score ||
        prev.lives !== state.lives ||
        prev.phase !== state.phase
      ) {
        const next = { score: state.score, lives: state.lives, phase: state.phase }
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

  // Keyboard handler — one step per keypress (e.repeat === false only)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.repeat) return
      let dx = 0, dy = 0
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault()
          dx = 0; dy = -1
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault()
          dx = 0; dy = 1
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          dx = -1; dy = 0
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          dx = 1; dy = 0
          break
        default:
          return
      }
      pendingDirRef.current = { dx, dy, pending: true }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="game-layout">
      <div className="game-wrapper">
        <div className="game-ui">
          <div>SCORE: {ui.score}</div>
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
