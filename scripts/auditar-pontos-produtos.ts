/**
 * Relatório: SKU e nome de venda com ponto (separador Santri vs polegada no nome).
 *
 * Uso:
 *   npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/auditar-pontos-produtos.ts
 *   npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/auditar-pontos-produtos.ts --company-id <uuid>
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function lerCompanyId(argv: string[]): string | undefined {
  const i = argv.indexOf('--company-id')
  return i >= 0 ? argv[i + 1] : undefined
}

async function main() {
  const companyIdArg = lerCompanyId(process.argv.slice(2))
  const empresas = companyIdArg
    ? await prisma.company.findMany({
        where: { id: companyIdArg },
        select: { id: true, name: true, active: true },
      })
    : await prisma.company.findMany({
        where: { active: true },
        select: { id: true, name: true, active: true },
        orderBy: { name: 'asc' },
      })

  for (const empresa of empresas) {
    const total = await prisma.produto.count({ where: { companyId: empresa.id } })
    const skuPonto = await prisma.produto.count({
      where: { companyId: empresa.id, sku: { contains: '.' } },
    })
    const nomePonto = await prisma.produto.count({
      where: { companyId: empresa.id, nomeVenda: { contains: '.' } },
    })
    const amostrasNome = await prisma.produto.findMany({
      where: { companyId: empresa.id, nomeVenda: { contains: '.' } },
      select: { sku: true, nomeVenda: true },
      take: 30,
      orderBy: { sku: 'asc' },
    })
    const polegadas = amostrasNome.filter((p) => /\d\.\d+\//.test(p.nomeVenda)).length

    console.log('---')
    console.log(`Empresa: ${empresa.id}  ${empresa.active ? 'ATIVA' : 'inativa'}  ${empresa.name}`)
    console.log(`Total produtos: ${total}`)
    console.log(`SKU com ponto: ${skuPonto}`)
    console.log(`Nome com ponto: ${nomePonto}`)
    console.log(`Amostra com padrão polegada (n.n/): ${polegadas} de ${amostrasNome.length}`)
    for (const p of amostrasNome) {
      console.log(`  ${p.sku ?? '—'}  ${p.nomeVenda}`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
