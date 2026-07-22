/**
 * One-shot: apaga NfeRecebida com origem=xml (importação manual) para permitir reimportar.
 * Uso: npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/limpar-nfe-origem-xml.ts
 */
import './carregar-url-do-banco.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const antes = await prisma.nfeRecebida.count({ where: { origem: 'xml' } })
  const amostra = await prisma.nfeRecebida.findMany({
    where: { origem: 'xml' },
    select: {
      id: true,
      companyId: true,
      chaveNfe: true,
      statusEntrada: true,
      tipoDocumento: true,
      dataEmissao: true,
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
  })

  console.log(`[limpar-xml] notas origem=xml antes: ${antes}`)
  for (const n of amostra) {
    console.log(
      `  - ${n.tipoDocumento} ${n.chaveNfe.slice(0, 20)}… status=${n.statusEntrada} company=${n.companyId.slice(0, 8)}…`
    )
  }
  if (antes > 20) console.log(`  … e mais ${antes - 20}`)

  if (antes === 0) {
    console.log('[limpar-xml] nada a apagar.')
    return
  }

  const result = await prisma.nfeRecebida.deleteMany({ where: { origem: 'xml' } })
  const depois = await prisma.nfeRecebida.count({ where: { origem: 'xml' } })

  console.log(`[limpar-xml] apagadas: ${result.count}`)
  console.log(`[limpar-xml] notas origem=xml depois: ${depois}`)
  console.log('[limpar-xml] ok — pode Importar XML de novo na Entrada de Notas.')
}

main()
  .catch((erro) => {
    console.error('[limpar-xml] falhou:', erro)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
