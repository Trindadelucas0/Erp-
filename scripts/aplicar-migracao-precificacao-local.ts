/** Aplicação isolada da migração aditiva enquanto o histórico legado contém uma pasta incompleta. */
import './carregar-url-do-banco.js'
import { readFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { clientePrisma } from '../src/compartilhado/banco-dados/cliente-prisma.js'

const nome = '20261016120000_precificacao_simplificada'
const host = new URL(process.env.DATABASE_URL!).hostname
if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) throw new Error('Este script só pode aplicar a migração no PostgreSQL local.')
const sql = await readFile(new URL(`../prisma/migrations/${nome}/migration.sql`, import.meta.url), 'utf8')
const checksum = createHash('sha256').update(sql).digest('hex')
try {
  await clientePrisma.$transaction(async db => {
    await db.$queryRaw`SELECT pg_advisory_xact_lock(16102026, 120000)::text`
    const historico = await db.$queryRaw<{ checksum: string; finished_at: Date | null }[]>`SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name = ${nome} AND rolled_back_at IS NULL`
    if (historico.length) {
      if (historico.length !== 1 || historico[0].checksum !== checksum || !historico[0].finished_at) throw new Error('A migração possui histórico divergente; nenhuma alteração foi aplicada.')
      console.log('Migração de precificação já aplicada com o mesmo checksum.')
      return
    }
    const pendentes = await db.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`
    if (Number(pendentes[0].total)) throw new Error('Existe migração não finalizada no banco. Nenhuma alteração foi aplicada.')
    for (const comando of sql.split(';').map(t => t.trim()).filter(Boolean)) await db.$executeRawUnsafe(comando)
    await db.$executeRaw`INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count) VALUES (${randomUUID()}, ${checksum}, CURRENT_TIMESTAMP, ${nome}, '', CURRENT_TIMESTAMP, 1)`
    console.log('Migração aditiva de precificação aplicada e registrada no banco local.')
  }, { timeout: 15000 })
} finally { await clientePrisma.$disconnect() }
