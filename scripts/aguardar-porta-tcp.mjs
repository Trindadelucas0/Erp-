/**
 * Aguarda uma porta TCP aceitar conexão (ex.: API pronta antes do Next no dev).
 * Uso: node scripts/aguardar-porta-tcp.mjs [host] [porta] [timeoutMs]
 */
import net from 'node:net'

const host = process.argv[2]?.trim() || '127.0.0.1'
const port = Number(process.argv[3] ?? 8885)
const timeoutMs = Number(process.argv[4] ?? 120_000)

if (!Number.isFinite(port) || port <= 0) {
  console.error('[aguardar-porta-tcp] Porta inválida:', process.argv[3])
  process.exit(1)
}

function tentarConectar() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.setTimeout(500, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

const inicio = Date.now()
while (Date.now() - inicio < timeoutMs) {
  if (await tentarConectar()) {
    process.exit(0)
  }
  await new Promise((r) => setTimeout(r, 250))
}

console.error(
  `[aguardar-porta-tcp] Timeout (${timeoutMs}ms) aguardando ${host}:${port}`
)
process.exit(1)
