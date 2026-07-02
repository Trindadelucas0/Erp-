import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

async function listarCfops(companyId: string, tipo = 'entrada', q?: string) {
  const termo = q?.trim()
  const cfops = await clientePrisma.cfop.findMany({
    where: {
      companyId,
      ativo: true,
      ...(tipo === 'entrada'
        ? { natureza: { in: ['entrada', 'importacao'] } }
        : { tipo }),
      ...(termo
        ? {
            OR: [
              { codigo: { contains: termo, mode: 'insensitive' } },
              { nome: { contains: termo, mode: 'insensitive' } },
              { descricao: { contains: termo, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { codigo: 'asc' },
    take: 50,
  })

  return cfops.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descricao: c.nome,
  }))
}

export const repositorioDeCatalogos = {
  listarCfops,
}
