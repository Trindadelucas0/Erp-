/**
 * Popula o banco com permissões, papéis, empresas e usuário admin.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { sincronizarPermissoes } from '../scripts/sincronizar-permissoes.js'

const prisma = new PrismaClient()

async function main() {
  console.log('Sincronizando permissões e papéis...')
  await sincronizarPermissoes()

  console.log('Criando empresas de exemplo...')

  const empresa1 = await prisma.company.upsert({
    where: { cnpj: '11111111000191' },
    update: {},
    create: {
      name: 'Empresa Alpha Ltda',
      cnpj: '11111111000191',
    },
  })

  const empresa2 = await prisma.company.upsert({
    where: { cnpj: '22222222000182' },
    update: {},
    create: {
      name: 'Empresa Beta Ltda',
      cnpj: '22222222000182',
    },
  })

  console.log('Criando usuário admin...')

  const papelAdmin = await prisma.role.findUnique({ where: { name: 'admin' } })

  if (!papelAdmin) {
    throw new Error('Papel admin não encontrado')
  }

  const senhaCriptografada = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@erp.local' },
    update: {
      name: 'Administrador',
      password: senhaCriptografada,
      active: true,
      tokenVersion: 0,
    },
    create: {
      name: 'Administrador',
      email: 'admin@erp.local',
      password: senhaCriptografada,
      roles: {
        create: [{ roleId: papelAdmin.id }],
      },
      companies: {
        create: [
          { companyId: empresa1.id },
          { companyId: empresa2.id },
        ],
      },
    },
  })

  await prisma.userRole.deleteMany({ where: { userId: admin.id } })
  await prisma.userCompany.deleteMany({ where: { userId: admin.id } })

  await prisma.userRole.create({
    data: { userId: admin.id, roleId: papelAdmin.id },
  })

  await prisma.userCompany.createMany({
    data: [
      { userId: admin.id, companyId: empresa1.id },
      { userId: admin.id, companyId: empresa2.id },
    ],
  })

  console.log('Sincronizando atalhos de teclado padrão...')

  const atalhosPadrao = [
    { acao: 'buscar', tecla: 'F3' },
    { acao: 'novo', tecla: 'F2' },
    { acao: 'salvar', tecla: 'F8' },
    { acao: 'cancelar', tecla: 'Escape' },
    { acao: 'atualizar', tecla: 'F5' },
    { acao: 'ajuda', tecla: 'F1' },
  ]

  for (const atalho of atalhosPadrao) {
    await prisma.atalhoTeclado.upsert({
      where: { acao: atalho.acao },
      update: {},
      create: {
        acao: atalho.acao,
        tecla: atalho.tecla,
        ativo: true,
      },
    })
  }

  console.log('Seed concluído!')
  console.log(`Admin: ${admin.email} / senha: admin123`)
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
