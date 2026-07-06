/**
 * Acesso ao banco de dados para pedidos de compra.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { Prisma } from '@prisma/client'
import {
  estornarReservaPedido,
  sincronizarReservaCreditoPedido,
} from './servico-movimentacao-credito.js'
import type {
  DadosParaCriarPedidoCompra,
  DadosParaEditarPedidoCompra,
} from './esquema-pedidos-compra.js'

const includeCompleto = {
  fornecedor: { select: { id: true, nome: true } },
  transportadora: { select: { id: true, nome: true } },
  pedidoVenda: { select: { id: true, numero: true, clienteNome: true } },
  itens: {
    include: {
      produto: { select: { id: true, nomeVenda: true, sku: true, unidade: true, ativo: true } },
    },
    orderBy: { ordem: 'asc' as const },
  },
} as const

type PedidoDb = Prisma.PedidoCompraGetPayload<{ include: typeof includeCompleto }>

export type PedidoCompraView = ReturnType<typeof mapearPedido>

function mapearItem(item: PedidoDb['itens'][number]) {
  return {
    id: item.id,
    produtoId: item.produtoId,
    produtoNome: item.produto.nomeVenda,
    produtoSku: item.produto.sku,
    produtoAtivo: item.produto.ativo,
    codigoOriginal: item.codigoOriginal,
    quantidade: Number(item.quantidade),
    unidade: item.unidade,
    precoUnitario: Number(item.precoUnitario),
    percentualDesconto: item.percentualDesconto ? Number(item.percentualDesconto) : null,
    valorDesconto: item.valorDesconto ? Number(item.valorDesconto) : null,
    outrasDespesas: item.outrasDespesas ? Number(item.outrasDespesas) : null,
    total: Number(item.total),
    totalLiquido: item.totalLiquido ? Number(item.totalLiquido) : Number(item.total),
    previsaoEntrega: item.previsaoEntrega,
    ordem: item.ordem,
  }
}

function mapearPedido(pedido: PedidoDb) {
  const itens = pedido.itens.map(mapearItem)
  const totalPedido = itens.reduce((s, i) => s + i.totalLiquido, 0)
  const frete = pedido.valorFrete ? Number(pedido.valorFrete) : 0

  return {
    id: pedido.id,
    numero: pedido.numero,
    descricao: pedido.descricao,
    fornecedorPessoaId: pedido.fornecedorPessoaId,
    fornecedorNome: pedido.fornecedor.nome,
    transportadoraPessoaId: pedido.transportadoraPessoaId,
    transportadoraNome: pedido.transportadora?.nome ?? null,
    modalidadeTransporte: pedido.modalidadeTransporte,
    condicaoPagamento: pedido.condicaoPagamento,
    tipoCompra: pedido.tipoCompra,
    dataFaturamento: pedido.dataFaturamento,
    previsaoEntrega: pedido.previsaoEntrega,
    valorFrete: pedido.valorFrete ? Number(pedido.valorFrete) : null,
    valorFreteSugerido: pedido.valorFreteSugerido ? Number(pedido.valorFreteSugerido) : null,
    prazosPagamento: pedido.prazosPagamento,
    rateioParcelas: pedido.rateioParcelas,
    status: pedido.status,
    motivoCancelamento: pedido.motivoCancelamento,
    observacoes: pedido.observacoes,
    observacoesInternas: pedido.observacoesInternas,
    copiadoDeId: pedido.copiadoDeId,
    pedidoVendaId: pedido.pedidoVendaId,
    pedidoVendaNumero: pedido.pedidoVenda?.numero ?? null,
    pedidoVendaCliente: pedido.pedidoVenda?.clienteNome ?? null,
    creditoFornecedorId: pedido.creditoFornecedorId,
    creditoAplicado: pedido.creditoAplicado ? Number(pedido.creditoAplicado) : null,
    totalPedido: totalPedido + frete,
    totalLiquido:
      pedido.creditoAplicado != null
        ? totalPedido + frete - Number(pedido.creditoAplicado)
        : totalPedido + frete,
    itens,
    createdAt: pedido.createdAt,
    updatedAt: pedido.updatedAt,
  }
}

async function proximoNumero(companyId: string, tx: Prisma.TransactionClient): Promise<number> {
  const ultimo = await tx.pedidoCompra.findFirst({
    where: { companyId },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  return (ultimo?.numero ?? 0) + 1
}

function calcularTotaisItem(item: {
  quantidade: number
  precoUnitario: number
  percentualDesconto?: number | null
  valorDesconto?: number | null
  outrasDespesas?: number | null
}) {
  const bruto = Math.round(item.quantidade * item.precoUnitario * 100) / 100
  let desconto = item.valorDesconto ?? 0
  if (item.percentualDesconto != null && item.percentualDesconto > 0) {
    desconto = Math.max(desconto, Math.round(bruto * (item.percentualDesconto / 100) * 100) / 100)
  }
  const outras = item.outrasDespesas ?? 0
  const liquido = Math.round((bruto - desconto + outras) * 100) / 100
  return { total: bruto, totalLiquido: liquido }
}

function dadosItemParaCreate(
  item: DadosParaCriarPedidoCompra['itens'][number],
  index: number
) {
  const { total, totalLiquido } = calcularTotaisItem(item)
  return {
    produtoId: item.produtoId,
    codigoOriginal: item.codigoOriginal || null,
    quantidade: item.quantidade,
    unidade: item.unidade,
    precoUnitario: item.precoUnitario,
    percentualDesconto: item.percentualDesconto ?? null,
    valorDesconto: item.valorDesconto ?? null,
    outrasDespesas: item.outrasDespesas ?? null,
    total,
    totalLiquido,
    previsaoEntrega: item.previsaoEntrega ?? null,
    ordem: item.ordem ?? index,
  }
}

function dadosCabecalhoParaCreate(dados: DadosParaCriarPedidoCompra) {
  return {
    fornecedorPessoaId: dados.fornecedorPessoaId,
    transportadoraPessoaId: dados.transportadoraPessoaId || null,
    modalidadeTransporte: dados.modalidadeTransporte || null,
    condicaoPagamento: dados.condicaoPagamento || null,
    tipoCompra: dados.tipoCompra || 'revenda',
    dataFaturamento: dados.dataFaturamento ?? null,
    previsaoEntrega: dados.previsaoEntrega ?? null,
    valorFrete: dados.valorFrete ?? null,
    valorFreteSugerido: dados.valorFreteSugerido ?? null,
    prazosPagamento: dados.prazosPagamento ?? null,
    rateioParcelas: dados.rateioParcelas || 'igual',
    observacoes: dados.observacoes || null,
    observacoesInternas: dados.observacoesInternas || null,
    descricao: dados.descricao || null,
    pedidoVendaId: dados.pedidoVendaId || null,
    creditoFornecedorId: dados.creditoFornecedorId || null,
    creditoAplicado: dados.creditoAplicado ?? null,
  }
}

async function listarPorEmpresa(
  companyId: string,
  filtros?: {
    fornecedorId?: string
    status?: string
    statusAberto?: boolean
    numero?: number
    busca?: string
    dataInicio?: Date
    dataFim?: Date
  }
) {
  const where: Prisma.PedidoCompraWhereInput = { companyId }

  if (filtros?.fornecedorId) {
    where.fornecedorPessoaId = filtros.fornecedorId
  }

  if (filtros?.busca?.trim()) {
    const termo = filtros.busca.trim().replace(/^#/, '')
    const numero = Number(termo)
    if (Number.isInteger(numero) && numero > 0) {
      where.OR = [
        { numero: { equals: numero } },
        { descricao: { contains: termo, mode: 'insensitive' } },
      ]
    } else {
      where.descricao = { contains: termo, mode: 'insensitive' }
    }
  } else if (filtros?.numero != null) {
    where.numero = filtros.numero
  }

  if (filtros?.dataInicio || filtros?.dataFim) {
    where.createdAt = {}
    if (filtros.dataInicio) {
      where.createdAt.gte = filtros.dataInicio
    }
    if (filtros.dataFim) {
      where.createdAt.lte = filtros.dataFim
    }
  }

  if (filtros?.statusAberto) {
    where.status = { in: ['rascunho', 'enviado', 'parcial'] }
  } else if (filtros?.status === 'feito') {
    where.status = { in: ['enviado', 'parcial', 'recebido'] }
  } else if (filtros?.status) {
    where.status = filtros.status
  }

  const pedidos = await clientePrisma.pedidoCompra.findMany({
    where,
    include: includeCompleto,
    orderBy: { numero: 'desc' },
  })

  return pedidos.map(mapearPedido)
}

async function buscarPorId(id: string) {
  return clientePrisma.pedidoCompra.findUnique({
    where: { id },
    include: includeCompleto,
  })
}

async function criar(dados: DadosParaCriarPedidoCompra, companyId: string) {
  const { concluir, ...dadosPedido } = dados

  return clientePrisma.$transaction(async (tx) => {
    const numero = await proximoNumero(companyId, tx)

    const pedido = await tx.pedidoCompra.create({
      data: {
        companyId,
        numero,
        status: concluir ? 'enviado' : 'rascunho',
        ...dadosCabecalhoParaCreate(dadosPedido),
        itens: {
          create: dadosPedido.itens.map(dadosItemParaCreate),
        },
      },
      include: includeCompleto,
    })

    await sincronizarReservaCreditoPedido(tx, {
      companyId,
      pedidoCompraId: pedido.id,
      pedidoNumero: pedido.numero,
      creditoFornecedorId: dados.creditoFornecedorId,
      creditoAplicado:
        dados.creditoAplicado != null ? Number(dados.creditoAplicado) : null,
    })

    const pedidoAtualizado = await tx.pedidoCompra.findUniqueOrThrow({
      where: { id: pedido.id },
      include: includeCompleto,
    })

    return mapearPedido(pedidoAtualizado)
  })
}

async function copiar(origemId: string, companyId: string) {
  const origem = await buscarPorId(origemId)
  if (!origem || origem.companyId !== companyId) {
    return null
  }

  return clientePrisma.$transaction(async (tx) => {
    const numero = await proximoNumero(companyId, tx)

    const pedido = await tx.pedidoCompra.create({
      data: {
        companyId,
        numero,
        fornecedorPessoaId: origem.fornecedorPessoaId,
        transportadoraPessoaId: origem.transportadoraPessoaId,
        modalidadeTransporte: origem.modalidadeTransporte,
        condicaoPagamento: origem.condicaoPagamento,
        tipoCompra: origem.tipoCompra,
        dataFaturamento: null,
        previsaoEntrega: origem.previsaoEntrega,
        valorFrete: origem.valorFrete,
        valorFreteSugerido: origem.valorFreteSugerido,
        prazosPagamento: origem.prazosPagamento ?? undefined,
        rateioParcelas: origem.rateioParcelas,
        observacoes: origem.observacoes,
        observacoesInternas: origem.observacoesInternas,
        descricao: origem.descricao,
        pedidoVendaId: origem.pedidoVendaId,
        copiadoDeId: origemId,
        status: 'rascunho',
        itens: {
          create: origem.itens.map((item, index) => ({
            produtoId: item.produtoId,
            codigoOriginal: item.codigoOriginal,
            quantidade: item.quantidade,
            unidade: item.unidade,
            precoUnitario: item.precoUnitario,
            percentualDesconto: item.percentualDesconto,
            valorDesconto: item.valorDesconto,
            outrasDespesas: item.outrasDespesas,
            total: item.total,
            totalLiquido: item.totalLiquido,
            previsaoEntrega: item.previsaoEntrega,
            ordem: index,
          })),
        },
      },
      include: includeCompleto,
    })

    return mapearPedido(pedido)
  })
}

async function atualizar(
  id: string,
  dados: DadosParaEditarPedidoCompra & { status?: string }
) {
  return clientePrisma.$transaction(async (tx) => {
    const existente = await tx.pedidoCompra.findUnique({ where: { id } })
    if (!existente) {
      throw new Error('Pedido de compra não encontrado')
    }

    if (dados.itens) {
      await tx.pedidoCompraItem.deleteMany({ where: { pedidoCompraId: id } })
    }

    const pedido = await tx.pedidoCompra.update({
      where: { id },
      data: {
        ...(dados.fornecedorPessoaId ? { fornecedorPessoaId: dados.fornecedorPessoaId } : {}),
        ...(dados.transportadoraPessoaId !== undefined
          ? { transportadoraPessoaId: dados.transportadoraPessoaId }
          : {}),
        ...(dados.modalidadeTransporte !== undefined
          ? { modalidadeTransporte: dados.modalidadeTransporte || null }
          : {}),
        ...(dados.condicaoPagamento !== undefined
          ? { condicaoPagamento: dados.condicaoPagamento || null }
          : {}),
        ...(dados.tipoCompra !== undefined ? { tipoCompra: dados.tipoCompra } : {}),
        ...(dados.dataFaturamento !== undefined ? { dataFaturamento: dados.dataFaturamento } : {}),
        ...(dados.previsaoEntrega !== undefined ? { previsaoEntrega: dados.previsaoEntrega } : {}),
        ...(dados.valorFrete !== undefined ? { valorFrete: dados.valorFrete } : {}),
        ...(dados.valorFreteSugerido !== undefined
          ? { valorFreteSugerido: dados.valorFreteSugerido }
          : {}),
        ...(dados.prazosPagamento !== undefined ? { prazosPagamento: dados.prazosPagamento } : {}),
        ...(dados.rateioParcelas !== undefined ? { rateioParcelas: dados.rateioParcelas } : {}),
        ...(dados.status ? { status: dados.status } : {}),
        ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes || null } : {}),
        ...(dados.observacoesInternas !== undefined
          ? { observacoesInternas: dados.observacoesInternas || null }
          : {}),
        ...(dados.descricao !== undefined ? { descricao: dados.descricao || null } : {}),
        ...(dados.pedidoVendaId !== undefined ? { pedidoVendaId: dados.pedidoVendaId } : {}),
        ...(dados.creditoFornecedorId !== undefined
          ? { creditoFornecedorId: dados.creditoFornecedorId }
          : {}),
        ...(dados.creditoAplicado !== undefined
          ? { creditoAplicado: dados.creditoAplicado }
          : {}),
        ...(dados.itens
          ? {
              itens: {
                create: dados.itens.map(dadosItemParaCreate),
              },
            }
          : {}),
      },
      include: includeCompleto,
    })

    const creditoFornecedorId =
      dados.creditoFornecedorId !== undefined
        ? dados.creditoFornecedorId
        : existente.creditoFornecedorId
    const creditoAplicado =
      dados.creditoAplicado !== undefined
        ? dados.creditoAplicado
        : existente.creditoAplicado != null
          ? Number(existente.creditoAplicado)
          : null

    await sincronizarReservaCreditoPedido(tx, {
      companyId: existente.companyId,
      pedidoCompraId: pedido.id,
      pedidoNumero: pedido.numero,
      creditoFornecedorId,
      creditoAplicado,
    })

    const pedidoAtualizado = await tx.pedidoCompra.findUniqueOrThrow({
      where: { id: pedido.id },
      include: includeCompleto,
    })

    return mapearPedido(pedidoAtualizado)
  })
}

async function cancelar(id: string, motivo: string) {
  return clientePrisma.$transaction(async (tx) => {
    const existente = await tx.pedidoCompra.findUnique({ where: { id } })
    if (!existente) {
      throw new Error('Pedido de compra não encontrado')
    }

    await estornarReservaPedido(
      tx,
      id,
      existente.companyId,
      existente.numero,
      'Cancelamento do pedido'
    )

    const pedido = await tx.pedidoCompra.update({
      where: { id },
      data: { status: 'cancelado', motivoCancelamento: motivo },
      include: includeCompleto,
    })

    return mapearPedido(pedido)
  })
}

async function listarCreditosFornecedor(companyId: string, fornecedorPessoaId: string) {
  return clientePrisma.creditoFornecedor.findMany({
    where: { companyId, fornecedorPessoaId, saldo: { gt: 0 } },
    orderBy: { vencimento: 'asc' },
  })
}

async function listarPendenciasFornecedor(companyId: string, fornecedorPessoaId: string) {
  return clientePrisma.pendenciaFornecedor.findMany({
    where: { companyId, fornecedorPessoaId, resolvido: false },
    include: { produto: { select: { id: true, nomeVenda: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

async function listarUltimasEntradasFornecedor(companyId: string, fornecedorPessoaId: string) {
  const pedidos = await clientePrisma.pedidoCompra.findMany({
    where: {
      companyId,
      fornecedorPessoaId,
      status: { in: ['recebido', 'parcial'] },
    },
    include: includeCompleto,
    orderBy: { updatedAt: 'desc' },
    take: 15,
  })

  return pedidos.map((p) => ({
    id: p.id,
    numero: p.numero,
    descricao: p.descricao,
    status: p.status,
    totalLiquido: mapearPedido(p).totalLiquido,
    data: p.updatedAt,
    itens: p.itens.length,
  }))
}

async function historicoComprasProduto(produtoId: string, companyId: string) {
  const itens = await clientePrisma.pedidoCompraItem.findMany({
    where: {
      produtoId,
      pedidoCompra: {
        companyId,
        status: { in: ['recebido', 'parcial', 'enviado'] },
      },
    },
    include: {
      pedidoCompra: {
        include: {
          fornecedor: { select: { nome: true } },
        },
      },
      produto: { select: { nomeVenda: true, sku: true } },
    },
    orderBy: { pedidoCompra: { updatedAt: 'desc' } },
    take: 20,
  })

  return itens.map((i) => ({
    pedidoNumero: i.pedidoCompra.numero,
    fornecedorNome: i.pedidoCompra.fornecedor.nome,
    data: i.pedidoCompra.updatedAt,
    quantidade: Number(i.quantidade),
    precoUnitario: Number(i.precoUnitario),
    precoCusto: Number(i.totalLiquido ?? i.total) / Number(i.quantidade),
    status: i.pedidoCompra.status,
  }))
}

export const repositorioDePedidosCompra = {
  listarPorEmpresa,
  buscarPorId,
  criar,
  copiar,
  atualizar,
  cancelar,
  listarCreditosFornecedor,
  listarPendenciasFornecedor,
  listarUltimasEntradasFornecedor,
  historicoComprasProduto,
  mapearPedido,
}
