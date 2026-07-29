import './carregar-url-do-banco.js'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const cols = await p.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'NfeRecebida'
      AND column_name IN ('problemaDesfecho', 'problemaMarcadoEm', 'problemaResolvidoEm')
    ORDER BY column_name
  `
  const tabela = await p.$queryRaw<Array<{ tabela: string | null }>>`
    SELECT to_regclass('public."NfeRecebidaTratativa"')::text AS tabela
  `
  console.log('colunas:', cols)
  console.log('tabela:', tabela)

  const amostra = await p.nfeRecebida.findMany({
    take: 1,
    select: {
      id: true,
      statusEntrada: true,
      problemaDesfecho: true,
    },
  })
  console.log('findMany ok:', amostra.length >= 0, amostra[0] ?? null)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
