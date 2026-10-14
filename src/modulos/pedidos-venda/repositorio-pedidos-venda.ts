import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

function numero(valor: unknown): number {
  return Number(valor ?? 0)
}

function mapear(registro: any) {
  return {
    ...registro,
    data: registro.data.toISOString().slice(0, 10),
    descontoTotal: numero(registro.descontoTotal),
    valorFrete: numero(registro.valorFrete),
    outrasDespesas: numero(registro.outrasDespesas),
    totalSt: numero(registro.totalSt),
    total: numero(registro.total),
    itens: (registro.itens ?? []).map((item: any) => ({
      ...item,
      quantidade: numero(item.quantidade),
      precoUnitario: numero(item.precoUnitario),
      percentualDesconto: numero(item.percentualDesconto),
      valorSt: numero(item.valorSt),
      total: numero(item.total),
    })),
  }
}

async function listar(companyId: string) {
  const registros = await clientePrisma.pedidoVenda.findMany({
    where: { companyId },
    include: {
      orcamento: { select: { numero: true } },
      itens: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return registros.map((registro) => ({
    id: registro.id,
    numero: registro.numero,
    data: registro.data.toISOString().slice(0, 10),
    clienteNome: registro.clienteNome,
    orcamentoNumero: registro.orcamento.numero,
    total: numero(registro.total),
    quantidadeItens: registro.itens.length,
  }))
}

async function buscarPorId(companyId: string, id: string) {
  const registro = await clientePrisma.pedidoVenda.findFirst({
    where: { id, companyId },
    include: {
      orcamento: { select: { numero: true } },
      itens: { orderBy: { ordem: 'asc' } },
    },
  })
  return registro ? mapear(registro) : null
}

export const repositorioPedidosVenda = { listar, buscarPorId }
