import { spawn } from 'child_process'
import { platform } from 'os'

const PORT = 5173
const isWin = platform() === 'win32'

console.log('Starting Pac-Man...')
console.log(`Game will open at http://localhost:${PORT}`)
console.log('Press Ctrl+C to stop.\n')

const vite = spawn(
  'npx',
  ['vite', '--open', '--port', String(PORT)],
  { stdio: 'inherit', shell: true }
)

vite.on('error', (err) => {
  console.error('Failed to start:', err.message)
  process.exit(1)
})

// Mirror Vite's exit code if it stops on its own
vite.on('close', (code) => {
  if (code !== null) process.exit(code)
})

function shutdown() {
  process.stdout.write('\nStopping...\n')
  if (isWin && vite.pid) {
    // /T kills the entire process tree (cmd.exe + node + vite)
    spawn('taskkill', ['/F', '/T', '/PID', String(vite.pid)], {
      shell: true,
      stdio: 'ignore',
    }).on('close', () => process.exit(0))
  } else {
    vite.kill('SIGTERM')
    process.exit(0)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
