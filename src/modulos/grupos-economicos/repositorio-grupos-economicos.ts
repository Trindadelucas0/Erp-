import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

async function listar(companyId: string, q?: string) {
  const termo = q?.trim()
  return clientePrisma.grupoEconomico.findMany({
    where: {
      companyId,
      ...(termo ? { nome: { contains: termo, mode: 'insensitive' } } : {}),
    },
    orderBy: { nome: 'asc' },
    take: 50,
    select: { id: true, nome: true },
  })
}

async function criar(companyId: string, nome: string) {
  return clientePrisma.grupoEconomico.upsert({
    where: { companyId_nome: { companyId, nome: nome.trim() } },
    update: {},
    create: { companyId, nome: nome.trim() },
    select: { id: true, nome: true },
  })
}

export const repositorioDeGruposEconomicos = { listar, criar }
