/**
 * Remove dados de demonstração criados por versões antigas do seed.
 */
import { PrismaClient } from '@prisma/client'

const CNPJS_EMPRESAS_EXEMPLO = ['11111111000191', '22222222000182']

const prisma = new PrismaClient()

async function main() {
  const empresasExemplo = await prisma.company.findMany({
    where: { cnpj: { in: CNPJS_EMPRESAS_EXEMPLO } },
    select: { id: true, name: true, cnpj: true },
  })

  for (const empresa of empresasExemplo) {
    await prisma.userCompany.deleteMany({ where: { companyId: empresa.id } })

    try {
      await prisma.company.delete({ where: { id: empresa.id } })
      console.log(`Empresa de exemplo removida: ${empresa.name} (${empresa.cnpj})`)
    } catch {
      console.warn(
        `Empresa de exemplo não removida (${empresa.name}): ainda há cadastros vinculados. Exclua os dados manualmente ou migre para outra empresa.`
      )
    }
  }

  if (empresasExemplo.length === 0) {
    console.log('Nenhuma empresa de exemplo encontrada no banco.')
  }

  console.log('Limpeza concluída.')
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
