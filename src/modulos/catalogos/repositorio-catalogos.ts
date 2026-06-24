import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

async function listarPlanosFinanceiros(companyId: string, q?: string) {
  const termo = q?.trim()
  return clientePrisma.planoFinanceiro.findMany({
    where: {
      companyId,
      ativo: true,
      ...(termo
        ? {
            OR: [
              { codigo: { contains: termo, mode: 'insensitive' } },
              { descricao: { contains: termo, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { codigo: 'asc' },
    take: 50,
  })
}

async function listarCfops(companyId: string, tipo = 'entrada', q?: string) {
  const termo = q?.trim()
  return clientePrisma.cfop.findMany({
    where: {
      companyId,
      ativo: true,
      tipo,
      ...(termo
        ? {
            OR: [
              { codigo: { contains: termo, mode: 'insensitive' } },
              { descricao: { contains: termo, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { codigo: 'asc' },
    take: 50,
  })
}

export const repositorioDeCatalogos = {
  listarPlanosFinanceiros,
  listarCfops,
}
