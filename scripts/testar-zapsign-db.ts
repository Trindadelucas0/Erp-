import '../scripts/carregar-url-do-banco.js'
import { clientePrisma } from '../src/compartilhado/banco-dados/cliente-prisma.js'

async function main() {
  const company = await clientePrisma.company.findFirst()
  console.log('company', company?.id ?? 'none')
  if (!company) return

  const registro = await clientePrisma.configuracaoZapsign.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      apiToken: 'test-token-1234567890',
      sandbox: true,
    },
    update: { sandbox: true },
  })
  console.log('upsert ok', registro.id)

  await clientePrisma.configuracaoZapsign.delete({ where: { companyId: company.id } })
  console.log('cleaned')
}

main().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
