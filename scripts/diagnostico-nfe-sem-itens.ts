/**
 * Conta NFe 55 sem NfeRecebidaItem (com/sem XML) — diagnóstico pré-reparo.
 * Uso: npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/diagnostico-nfe-sem-itens.ts
 * Opcional: --companyId=<uuid>
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const companyIdArg = process.argv.find((a) => a.startsWith('--companyId='))?.split('=')[1]

  const agrupado = companyIdArg
    ? await prisma.$queryRaw<
        Array<{ situacao: string; statusEntrada: string; qtd: number }>
      >`
      SELECT
        CASE WHEN n."xmlConteudo" IS NULL THEN 'sem_xml' ELSE 'com_xml' END AS situacao,
        n."statusEntrada" AS "statusEntrada",
        count(*)::int AS qtd
      FROM "NfeRecebida" n
      WHERE n."tipoDocumento" = 'nfe55'
        AND n."companyId" = ${companyIdArg}
        AND NOT EXISTS (SELECT 1 FROM "NfeRecebidaItem" i WHERE i."nfeRecebidaId" = n.id)
      GROUP BY 1, 2
      ORDER BY qtd DESC
    `
    : await prisma.$queryRaw<
        Array<{ situacao: string; statusEntrada: string; qtd: number }>
      >`
      SELECT
        CASE WHEN n."xmlConteudo" IS NULL THEN 'sem_xml' ELSE 'com_xml' END AS situacao,
        n."statusEntrada" AS "statusEntrada",
        count(*)::int AS qtd
      FROM "NfeRecebida" n
      WHERE n."tipoDocumento" = 'nfe55'
        AND NOT EXISTS (SELECT 1 FROM "NfeRecebidaItem" i WHERE i."nfeRecebidaId" = n.id)
      GROUP BY 1, 2
      ORDER BY qtd DESC
    `

  console.log('=== NFe 55 SEM ITENS (agrupado) ===')
  console.log(JSON.stringify(agrupado, null, 2))
  console.log(
    'total:',
    agrupado.reduce((a, r) => a + Number(r.qtd), 0)
  )

  const amostra = companyIdArg
    ? await prisma.$queryRaw<
        Array<{
          id: string
          chaveNfe: string
          statusEntrada: string
          temXml: boolean
          companyId: string
        }>
      >`
      SELECT
        n.id,
        n."chaveNfe" AS "chaveNfe",
        n."statusEntrada" AS "statusEntrada",
        (n."xmlConteudo" IS NOT NULL) AS "temXml",
        n."companyId" AS "companyId"
      FROM "NfeRecebida" n
      WHERE n."tipoDocumento" = 'nfe55'
        AND n."companyId" = ${companyIdArg}
        AND NOT EXISTS (SELECT 1 FROM "NfeRecebidaItem" i WHERE i."nfeRecebidaId" = n.id)
      ORDER BY n."updatedAt" DESC
      LIMIT 20
    `
    : await prisma.$queryRaw<
        Array<{
          id: string
          chaveNfe: string
          statusEntrada: string
          temXml: boolean
          companyId: string
        }>
      >`
      SELECT
        n.id,
        n."chaveNfe" AS "chaveNfe",
        n."statusEntrada" AS "statusEntrada",
        (n."xmlConteudo" IS NOT NULL) AS "temXml",
        n."companyId" AS "companyId"
      FROM "NfeRecebida" n
      WHERE n."tipoDocumento" = 'nfe55'
        AND NOT EXISTS (SELECT 1 FROM "NfeRecebidaItem" i WHERE i."nfeRecebidaId" = n.id)
      ORDER BY n."updatedAt" DESC
      LIMIT 20
    `

  console.log('=== AMOSTRA (até 20) ===')
  for (const n of amostra) {
    console.log(
      `${n.temXml ? 'COM_XML' : 'SEM_XML'} | ${n.statusEntrada} | ${n.chaveNfe} | ${n.id}`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
