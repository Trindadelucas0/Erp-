import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaCamposEscalares } from '../../compartilhado/utilitarios/filtro-busca-textual.js'

async function listarCfops(companyId: string, tipo = 'entrada', q?: string) {
  const filtroBusca = montarFiltroBuscaCamposEscalares(q, ['codigo', 'nome', 'descricao'])
  const cfops = await clientePrisma.cfop.findMany({
    where: {
      companyId,
      ativo: true,
      ...(tipo === 'entrada'
        ? { natureza: { in: ['entrada', 'importacao'] } }
        : { tipo }),
      ...(filtroBusca ?? {}),
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
