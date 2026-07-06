/**
 * Regras de negócio para pedidos de compra.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { repositorioDePedidosCompra } from './repositorio-pedidos-compra.js'
import { repositorioPedidosVenda } from './repositorio-pedidos-venda.js'
import { servicoCreditosPendencias } from './servico-creditos-pendencias.js'
import { conferirPedidoCompraComEntrada } from './conferencia-po-entrada.js'
import { compararPedidoComPdf } from './comparador-pdf-pedido.js'
import {
  calcularTotalLiquidoPedido,
  normalizarPrazosPagamento,
} from './parcelas-pagamento.js'
import { baixarReservaPedido } from './servico-movimentacao-credito.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosParaCriarPedidoCompra,
  DadosParaEditarPedidoCompra,
  DadosConferenciaEntrada,
} from './esquema-pedidos-compra.js'

async function validarFornecedor(fornecedorPessoaId: string, companyId: string) {
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      id: fornecedorPessoaId,
      companyId,
      papeis: { some: { papel: 'fornecedor', ativo: true } },
    },
  })
  if (!pessoa) {
    throw new ErroDaAplicacao('Fornecedor inválido ou inativo', 400)
  }
}

async function validarTransportadora(
  transportadoraPessoaId: string | null | undefined,
  companyId: string
) {
  if (!transportadoraPessoaId) return

  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      id: transportadoraPessoaId,
      companyId,
      papeis: { some: { papel: 'transportadora', ativo: true } },
    },
  })
  if (!pessoa) {
    throw new ErroDaAplicacao('Transportadora inválida ou inativa', 400)
  }
}

async function validarPedidoVenda(
  pedidoVendaId: string | null | undefined,
  companyId: string
) {
  if (!pedidoVendaId) return

  const pedido = await repositorioPedidosVenda.buscarPorId(pedidoVendaId, companyId)
  if (!pedido) {
    throw new ErroDaAplicacao('Pedido de venda sob encomenda não encontrado', 400)
  }
}

async function validarItens(
  itens: { produtoId: string }[],
  companyId: string
) {
  for (const item of itens) {
    const produto = await clientePrisma.produto.findFirst({
      where: { id: item.produtoId, companyId, ativo: true },
    })
    if (!produto) {
      throw new ErroDaAplicacao('Produto inexistente ou inativo no pedido', 400)
    }
  }
}

async function listarPedidosCompra(
  companyId: string,
  filtros?: {
    fornecedorId?: string
    status?: string
    statusAberto?: boolean
    numero?: number
    dataInicio?: Date
    dataFim?: Date
  }
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  return repositorioDePedidosCompra.listarPorEmpresa(companyId, filtros)
}

async function buscarPedidoCompra(id: string, companyId: string) {
  const pedido = await repositorioDePedidosCompra.buscarPorId(id)
  if (!pedido || pedido.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }
  return repositorioDePedidosCompra.mapearPedido(pedido)
}

function prepararDadosComPrazos(
  dados: DadosParaCriarPedidoCompra | DadosParaEditarPedidoCompra,
  itens: DadosParaCriarPedidoCompra['itens']
) {
  if (!itens?.length) return dados
  if (dados.prazosPagamento === undefined) return dados

  const totalLiquido = calcularTotalLiquidoPedido(
    itens,
    dados.valorFrete,
    dados.creditoAplicado
  )

  const prazosNormalizados = normalizarPrazosPagamento(
    dados.prazosPagamento,
    dados.rateioParcelas,
    totalLiquido
  )

  return { ...dados, prazosPagamento: prazosNormalizados }
}

async function criarPedidoCompra(
  dados: DadosParaCriarPedidoCompra,
  companyId: string,
  idDoAutor: string
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  await validarFornecedor(dados.fornecedorPessoaId, companyId)
  await validarTransportadora(dados.transportadoraPessoaId, companyId)
  await validarPedidoVenda(dados.pedidoVendaId, companyId)
  await validarItens(dados.itens, companyId)

  const creditoValidado = await servicoCreditosPendencias.validarCreditoNoPedido(
    dados.creditoFornecedorId,
    dados.creditoAplicado ?? undefined,
    dados.fornecedorPessoaId,
    companyId
  )

  const dadosComCredito = creditoValidado
    ? {
        ...dados,
        creditoFornecedorId: creditoValidado.creditoFornecedorId,
        creditoAplicado: creditoValidado.creditoAplicado,
      }
    : dados

  const dadosFinais = prepararDadosComPrazos(dadosComCredito, dadosComCredito.itens)

  const pedido = await repositorioDePedidosCompra.criar(dadosFinais, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'pedido_compra',
    entidadeId: pedido.id,
    valoresDepois: { numero: pedido.numero, fornecedor: pedido.fornecedorNome },
  })

  return pedido
}

async function copiarPedidoCompra(id: string, companyId: string, idDoAutor: string) {
  const copia = await repositorioDePedidosCompra.copiar(id, companyId)
  if (!copia) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'copiar',
    entidade: 'pedido_compra',
    entidadeId: copia.id,
    valoresDepois: { numero: copia.numero, copiadoDeId: id },
  })

  return copia
}

async function editarPedidoCompra(
  id: string,
  dados: DadosParaEditarPedidoCompra,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDePedidosCompra.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  if (existente.status === 'cancelado' || existente.status === 'recebido') {
    throw new ErroDaAplicacao('Pedido não pode ser editado neste status', 400)
  }

  const { concluir, ...dadosSemConcluir } = dados

  if (dadosSemConcluir.fornecedorPessoaId) {
    await validarFornecedor(dadosSemConcluir.fornecedorPessoaId, companyId)
  }
  await validarTransportadora(dadosSemConcluir.transportadoraPessoaId, companyId)
  await validarPedidoVenda(dadosSemConcluir.pedidoVendaId, companyId)
  if (dadosSemConcluir.itens) {
    await validarItens(dadosSemConcluir.itens, companyId)
  }

  const fornecedorId = dadosSemConcluir.fornecedorPessoaId ?? existente.fornecedorPessoaId
  const creditoValidado = await servicoCreditosPendencias.validarCreditoNoPedido(
    dadosSemConcluir.creditoFornecedorId !== undefined
      ? dadosSemConcluir.creditoFornecedorId
      : existente.creditoFornecedorId,
    dadosSemConcluir.creditoAplicado !== undefined
      ? dadosSemConcluir.creditoAplicado ?? undefined
      : existente.creditoAplicado
        ? Number(existente.creditoAplicado)
        : undefined,
    fornecedorId,
    companyId,
    id
  )

  const dadosComCredito = creditoValidado
    ? {
        ...dadosSemConcluir,
        creditoFornecedorId: creditoValidado.creditoFornecedorId,
        creditoAplicado: creditoValidado.creditoAplicado,
      }
    : dadosSemConcluir

  const itensParaTotal =
    dadosComCredito.itens ??
    existente.itens.map((i) => ({
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
      percentualDesconto: i.percentualDesconto ? Number(i.percentualDesconto) : null,
      valorDesconto: i.valorDesconto ? Number(i.valorDesconto) : null,
      outrasDespesas: i.outrasDespesas ? Number(i.outrasDespesas) : null,
    }))

  const dadosFinais = prepararDadosComPrazos(
    {
      ...dadosComCredito,
      valorFrete:
        dadosComCredito.valorFrete !== undefined
          ? dadosComCredito.valorFrete
          : existente.valorFrete
            ? Number(existente.valorFrete)
            : null,
      creditoAplicado:
        dadosComCredito.creditoAplicado !== undefined
          ? dadosComCredito.creditoAplicado
          : existente.creditoAplicado
            ? Number(existente.creditoAplicado)
            : null,
      rateioParcelas:
        dadosComCredito.rateioParcelas ??
        (existente.rateioParcelas as 'igual' | 'manual' | undefined),
      prazosPagamento:
        dadosComCredito.prazosPagamento !== undefined
          ? dadosComCredito.prazosPagamento
          : (existente.prazosPagamento as DadosParaEditarPedidoCompra['prazosPagamento']),
    },
    itensParaTotal as DadosParaCriarPedidoCompra['itens']
  )

  const pedido = await repositorioDePedidosCompra.atualizar(id, {
    ...dadosFinais,
    ...(concluir && existente.status === 'rascunho' ? { status: 'enviado' } : {}),
  })

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: { numero: pedido.numero, status: pedido.status },
  })

  return pedido
}

async function cancelarPedidoCompra(
  id: string,
  motivo: string,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDePedidosCompra.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  if (existente.status === 'cancelado') {
    throw new ErroDaAplicacao('Pedido já está cancelado', 400)
  }

  if (existente.status === 'recebido') {
    throw new ErroDaAplicacao('Pedido já recebido não pode ser cancelado', 400)
  }

  const pedido = await repositorioDePedidosCompra.cancelar(id, motivo)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'cancelar',
    entidade: 'pedido_compra',
    entidadeId: id,
    valoresDepois: { motivo },
  })

  return pedido
}

async function obterContextoFornecedor(fornecedorPessoaId: string, companyId: string) {
  const [pedidosAbertos, creditos, pendencias, ultimasEntradas] = await Promise.all([
    repositorioDePedidosCompra.listarPorEmpresa(companyId, {
      fornecedorId: fornecedorPessoaId,
      statusAberto: true,
    }),
    repositorioDePedidosCompra.listarCreditosFornecedor(companyId, fornecedorPessoaId),
    repositorioDePedidosCompra.listarPendenciasFornecedor(companyId, fornecedorPessoaId),
    repositorioDePedidosCompra.listarUltimasEntradasFornecedor(companyId, fornecedorPessoaId),
  ])

  return {
    pedidosAbertos,
    creditos: creditos.map((c) => ({
      id: c.id,
      valor: Number(c.valor),
      saldo: Number(c.saldo),
      origem: c.origem,
      vencimento: c.vencimento,
    })),
    pendencias: pendencias.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      descricao: p.descricao,
      produtoId: p.produtoId,
      produtoNome: p.produto?.nomeVenda ?? null,
    })),
    ultimasEntradas,
    historicoComprasProduto: [],
  }
}

async function conferirComEntrada(
  id: string,
  dados: DadosConferenciaEntrada,
  companyId: string
) {
  const pedido = await repositorioDePedidosCompra.buscarPorId(id)
  if (!pedido || pedido.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  const divergencias = conferirPedidoCompraComEntrada(
    {
      condicaoPagamento: pedido.condicaoPagamento,
      transportadoraPessoaId: pedido.transportadoraPessoaId,
      modalidadeTransporte: pedido.modalidadeTransporte,
      itens: pedido.itens.map((i) => ({
        produtoId: i.produtoId,
        precoUnitario: Number(i.precoUnitario),
        produto: i.produto,
      })),
    },
    dados
  )

  return { divergencias, temDivergencia: divergencias.length > 0 }
}

async function compararComPdf(id: string, base64Pdf: string, companyId: string) {
  const pedidoDb = await repositorioDePedidosCompra.buscarPorId(id)
  if (!pedidoDb || pedidoDb.companyId !== companyId) {
    throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
  }

  const pedido = repositorioDePedidosCompra.mapearPedido(pedidoDb)
  return compararPedidoComPdf(pedido, base64Pdf)
}

async function historicoProduto(produtoId: string, companyId: string) {
  return repositorioDePedidosCompra.historicoComprasProduto(produtoId, companyId)
}

async function listarPedidosVendaEncomenda(companyId: string, busca?: string) {
  return repositorioPedidosVenda.listarParaEncomenda(companyId, busca)
}

async function baixarCreditoNaEntrada(pedidoCompraId: string, companyId: string) {
  return clientePrisma.$transaction(async (tx) => {
    const pedido = await tx.pedidoCompra.findFirst({
      where: { id: pedidoCompraId, companyId },
    })
    if (!pedido) {
      throw new ErroDaAplicacao('Pedido de compra não encontrado', 404)
    }

    return baixarReservaPedido(tx, pedidoCompraId, companyId)
  })
}

export const servicoDePedidosCompra = {
  listarPedidosCompra,
  buscarPedidoCompra,
  criarPedidoCompra,
  copiarPedidoCompra,
  editarPedidoCompra,
  cancelarPedidoCompra,
  obterContextoFornecedor,
  conferirComEntrada,
  compararComPdf,
  historicoProduto,
  listarPedidosVendaEncomenda,
  baixarCreditoNaEntrada,
}
