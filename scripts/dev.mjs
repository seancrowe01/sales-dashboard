// Runs the Airtable proxy and the Vite dev server together so "npm run dev" is the only command
// needed locally. Extra arguments are passed through to Vite (for example "-- --port 5179").
// Ctrl+C stops both.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viteArgs = process.argv.slice(2)
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

const children = []

function start(label, command, args) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  child.on('exit', (code, signal) => {
    if (signal) return
    console.log(`[dev] ${label} exited with code ${code ?? 0}`)
    if (label === 'vite') shutdown(code ?? 0)
  })
  children.push(child)
  return child
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('[dev] starting the data server on PROXY_PORT from .env (default 8787)')
start('proxy', process.execPath, [path.join('server', 'index.mjs')])

console.log('[dev] starting Vite')
start('vite', process.execPath, [VITE_BIN, ...viteArgs])
