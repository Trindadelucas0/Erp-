/**
 * Executa comandos do Prisma após montar DATABASE_URL das variáveis DB_*.
 * Uso: tsx scripts/executar-prisma.ts migrate dev
 */
import './carregar-url-do-banco.js'
import { spawnSync } from 'child_process'

const argumentosDoComando = process.argv.slice(2)

if (argumentosDoComando.length === 0) {
  console.error('Informe o comando do Prisma. Ex: migrate dev')
  process.exit(1)
}

const resultado = spawnSync('npx', ['prisma', ...argumentosDoComando], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

process.exit(resultado.status ?? 1)
