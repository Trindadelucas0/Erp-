/**
 * Persistência de pedidos de venda (MVP).
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { Prisma } from '@prisma/client'
import type { DadosParaCriarPedidoVenda, DadosParaEditarPedidoVenda } from './esquema-pedidos-venda.js'

const includeCompleto = {
  itens: {
    include: {
      produto: {
        select: {
          id: true,
          nomeVenda: true,
          sku: true,
          unidade: true,
          ativo: true,
          bloqueadoVenda: true,
          multiploVenda: true,
          permiteVendaFracionada: true,
        },
      },
    },
    orderBy: { ordem: 'asc' as const },
  },
} as const

type PedidoDb = Prisma.PedidoVendaGetPayload<{ include: typeof includeCompleto }>

function mapearItem(item: PedidoDb['itens'][number]) {
  return {
    id: item.id,
    produtoId: item.produtoId,
    produtoNome: item.produto.nomeVenda,
    produtoSku: item.produto.sku,
    modoQuantidade: item.modoQuantidade as 'UN' | 'CX',
    quantidadeInformada: Number(item.quantidadeInformada),
    quantidadeUnidadeVenda: Number(item.quantidadeUnidadeVenda),
    itensPorEmbalagem: Number(item.itensPorEmbalagem),
    unidade: item.unidade,
    precoUnitario: Number(item.precoUnitario),
    total: Number(item.total),
    ordem: item.ordem,
  }
}

function mapearPedido(pedido: PedidoDb) {
  const itens = pedido.itens.map(mapearItem)
  return {
    id: pedido.id,
    numero: pedido.numero,
    clienteNome: pedido.clienteNome,
    status: pedido.status,
    sobEncomenda: pedido.sobEncomenda,
    observacoes: pedido.observacoes,
    totalLiquido: Number(pedido.totalLiquido),
    itens,
    createdAt: pedido.createdAt,
    updatedAt: pedido.updatedAt,
  }
}

export type PedidoVendaView = ReturnType<typeof mapearPedido>

export type ItemCalculadoPedidoVenda = {
  produtoId: string
  modoQuantidade: 'UN' | 'CX'
  quantidadeInformada: number
  quantidadeUnidadeVenda: number
  itensPorEmbalagem: number
  unidade: string
  precoUnitario: number
  total: number
  ordem: number
}

async function proximoNumero(companyId: string, tx: Prisma.TransactionClient) {
  const ultimo = await tx.pedidoVenda.findFirst({
    where: { companyId },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  return (ultimo?.numero ?? 0) + 1
}

async function listar(companyId: string, busca?: string) {
  const where: Prisma.PedidoVendaWhereInput = {
    companyId,
    ...(busca?.trim()
      ? {
          OR: [
            { clienteNome: { contains: busca.trim(), mode: 'insensitive' } },
            ...(/^\d+$/.test(busca.trim())
              ? [{ numero: { equals: Number(busca.trim()) } }]
              : []),
          ],
        }
      : {}),
  }

  const pedidos = await clientePrisma.pedidoVenda.findMany({
    where,
    include: includeCompleto,
    orderBy: { numero: 'desc' },
    take: 100,
  })
  return pedidos.map(mapearPedido)
}

async function buscarPorId(id: string, companyId: string) {
  const pedido = await clientePrisma.pedidoVenda.findFirst({
    where: { id, companyId },
    include: includeCompleto,
  })
  return pedido ? mapearPedido(pedido) : null
}

async function criar(
  dados: DadosParaCriarPedidoVenda,
  itens: ItemCalculadoPedidoVenda[],
  companyId: string,
  status: string
) {
  const totalLiquido = itens.reduce((s, i) => s + i.total, 0)

  const pedido = await clientePrisma.$transaction(async (tx) => {
    const numero = await proximoNumero(companyId, tx)
    return tx.pedidoVenda.create({
      data: {
        companyId,
        numero,
        clienteNome: dados.clienteNome,
        observacoes: dados.observacoes || null,
        sobEncomenda: dados.sobEncomenda ?? false,
        status,
        totalLiquido,
        itens: {
          create: itens.map((item) => ({
            produtoId: item.produtoId,
            modoQuantidade: item.modoQuantidade,
            quantidadeInformada: item.quantidadeInformada,
            quantidadeUnidadeVenda: item.quantidadeUnidadeVenda,
            itensPorEmbalagem: item.itensPorEmbalagem,
            unidade: item.unidade,
            precoUnitario: item.precoUnitario,
            total: item.total,
            ordem: item.ordem,
          })),
        },
      },
      include: includeCompleto,
    })
  })

  return mapearPedido(pedido)
}

async function atualizar(
  id: string,
  dados: DadosParaEditarPedidoVenda,
  itens: ItemCalculadoPedidoVenda[],
  companyId: string,
  status: string
) {
  const totalLiquido = itens.reduce((s, i) => s + i.total, 0)

  const pedido = await clientePrisma.$transaction(async (tx) => {
    await tx.pedidoVendaItem.deleteMany({ where: { pedidoVendaId: id } })
    return tx.pedidoVenda.update({
      where: { id },
      data: {
        clienteNome: dados.clienteNome,
        observacoes: dados.observacoes || null,
        sobEncomenda: dados.sobEncomenda ?? false,
        status,
        totalLiquido,
        itens: {
          create: itens.map((item) => ({
            produtoId: item.produtoId,
            modoQuantidade: item.modoQuantidade,
            quantidadeInformada: item.quantidadeInformada,
            quantidadeUnidadeVenda: item.quantidadeUnidadeVenda,
            itensPorEmbalagem: item.itensPorEmbalagem,
            unidade: item.unidade,
            precoUnitario: item.precoUnitario,
            total: item.total,
            ordem: item.ordem,
          })),
        },
      },
      include: includeCompleto,
    })
  })

  // companyId check already done by caller; ensure we don't leak cross-company
  if (pedido.companyId !== companyId) {
    throw new Error('Pedido de outra empresa')
  }

  return mapearPedido(pedido)
}

async function cancelar(id: string, companyId: string) {
  const pedido = await clientePrisma.pedidoVenda.updateMany({
    where: { id, companyId, status: { in: ['rascunho', 'aberto'] } },
    data: { status: 'cancelado' },
  })
  return pedido.count > 0
}

export const repositorioDePedidosVenda = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  cancelar,
}
