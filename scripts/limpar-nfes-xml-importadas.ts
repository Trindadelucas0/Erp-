/**
 * Remove NFes importadas via XML para permitir reimportação de teste.
 * Uso: npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/limpar-nfes-xml-importadas.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const porOrigem = await prisma.nfeRecebida.groupBy({
    by: ['origem'],
    _count: true,
  })
  console.log('Antes:', JSON.stringify(porOrigem, null, 2))

  const xmls = await prisma.nfeRecebida.findMany({
    where: { origem: 'xml' },
    select: {
      id: true,
      chaveNfe: true,
      nomeEmitente: true,
      statusEntrada: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`NFes com origem=xml: ${xmls.length}`)
  for (const n of xmls) {
    console.log(`- ${n.chaveNfe} | ${n.nomeEmitente ?? '-'} | ${n.statusEntrada} | ${n.createdAt.toISOString()}`)
  }

  // Itens caem por cascade; deleteMany nas NFes xml
  const itens = await prisma.nfeRecebidaItem.deleteMany({
    where: { nfeRecebida: { origem: 'xml' } },
  })
  const nfes = await prisma.nfeRecebida.deleteMany({
    where: { origem: 'xml' },
  })

  // Jobs de importação (histórico opcional)
  const jobs = await prisma.focusNfeJob.deleteMany({
    where: { tipo: 'import_xml' },
  })

  console.log(`Itens removidos: ${itens.count}`)
  console.log(`NFes XML removidas: ${nfes.count}`)
  console.log(`Jobs import_xml removidos: ${jobs.count}`)

  const depois = await prisma.nfeRecebida.groupBy({
    by: ['origem'],
    _count: true,
  })
  console.log('Depois:', JSON.stringify(depois, null, 2))
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
