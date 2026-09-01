/**
 * Sobe o Next com NODE_OPTIONS no ambiente (workers do webpack herdam o heap).
 * Uso: node ./scripts/dev-next.mjs [dev|build|start ...]
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, '..')

const heapMb = process.env.ERP_NEXT_HEAP_MB?.trim() || '8192'
const flagHeap = `--max-old-space-size=${heapMb}`
const existente = process.env.NODE_OPTIONS?.trim() ?? ''
process.env.NODE_OPTIONS = existente.includes('max-old-space-size')
  ? existente
  : existente
    ? `${existente} ${flagHeap}`
    : flagHeap

const nextCli = path.join(frontendRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
const args = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['dev', '-p', '3333']

const child = spawn(process.execPath, [nextCli, ...args], {
  cwd: frontendRoot,
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
