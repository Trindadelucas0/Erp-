/**
 * Repositório mínimo de pedidos de venda (encomenda).
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

async function listarParaEncomenda(companyId: string, busca?: string) {
  const where: {
    companyId: string
    sobEncomenda: boolean
    status: { in: string[] }
    OR?: { numero?: { equals: number }; clienteNome?: { contains: string; mode: 'insensitive' } }[]
  } = {
    companyId,
    sobEncomenda: true,
    status: { in: ['aberto', 'rascunho', 'parcial'] },
  }

  if (busca?.trim()) {
    const numero = Number(busca.replace(/^#/, '').trim())
    if (Number.isInteger(numero) && numero > 0) {
      where.OR = [{ numero: { equals: numero } }, { clienteNome: { contains: busca, mode: 'insensitive' } }]
    } else {
      where.OR = [{ clienteNome: { contains: busca, mode: 'insensitive' } }]
    }
  }

  const pedidos = await clientePrisma.pedidoVenda.findMany({
    where,
    orderBy: { numero: 'desc' },
    take: 30,
  })

  return pedidos.map((p) => ({
    id: p.id,
    numero: p.numero,
    clienteNome: p.clienteNome,
    status: p.status,
    sobEncomenda: p.sobEncomenda,
  }))
}

async function buscarPorId(id: string, companyId: string) {
  return clientePrisma.pedidoVenda.findFirst({
    where: { id, companyId, sobEncomenda: true },
  })
}

export const repositorioPedidosVenda = {
  listarParaEncomenda,
  buscarPorId,
}
