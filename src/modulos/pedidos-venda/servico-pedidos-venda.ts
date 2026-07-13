/**
 * Regras de negócio do pedido de venda (MVP).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosItemPedidoVenda,
  DadosParaCriarPedidoVenda,
  DadosParaEditarPedidoVenda,
} from './esquema-pedidos-venda.js'
import {
  repositorioDePedidosVenda,
  type ItemCalculadoPedidoVenda,
} from './repositorio-pedidos-venda.js'
import {
  converterQtdParaUnidadeVenda,
  resolverItensNaCaixa,
  validarQuantidadeModoCx,
} from './regras-venda-produto.js'

async function carregarProdutosDosItens(itens: DadosItemPedidoVenda[], companyId: string) {
  const ids = [...new Set(itens.map((i) => i.produtoId))]
  const produtos = await clientePrisma.produto.findMany({
    where: { companyId, id: { in: ids } },
    include: {
      embalagensMaster: { orderBy: { ordem: 'asc' }, take: 1 },
      fornecedores: { orderBy: { ordem: 'asc' }, take: 1 },
    },
  })

  if (produtos.length !== ids.length) {
    throw new ErroDaAplicacao('Um ou mais produtos não foram encontrados', 400)
  }

  return new Map(produtos.map((p) => [p.id, p]))
}

function calcularItens(
  itens: DadosItemPedidoVenda[],
  produtos: Map<
    string,
    {
      id: string
      ativo: boolean
      bloqueadoVenda: boolean
      unidade: string
      multiploVenda: { toNumber?: () => number } | number
      permiteVendaFracionada: boolean
      embalagensMaster: { quantidade: { toNumber?: () => number } | number }[]
      fornecedores: { multiplicadorEntrada: { toNumber?: () => number } | number | null }[]
    }
  >
): ItemCalculadoPedidoVenda[] {
  return itens.map((item, ordem) => {
    const produto = produtos.get(item.produtoId)
    if (!produto) {
      throw new ErroDaAplicacao('Produto inválido', 400)
    }
    if (!produto.ativo) {
      throw new ErroDaAplicacao('Produto inativo não pode ser vendido', 400)
    }
    if (produto.bloqueadoVenda) {
      throw new ErroDaAplicacao('Produto bloqueado para venda', 400)
    }

    const multiploVenda =
      typeof produto.multiploVenda === 'number'
        ? produto.multiploVenda
        : Number(produto.multiploVenda)

    const itensNaCaixa = resolverItensNaCaixa({
      unidade: produto.unidade,
      multiploVenda,
      permiteVendaFracionada: produto.permiteVendaFracionada,
      embalagensMaster: produto.embalagensMaster.map((e) => ({
        quantidade:
          typeof e.quantidade === 'number' ? e.quantidade : Number(e.quantidade),
      })),
      fornecedores: produto.fornecedores.map((f) => ({
        multiplicadorEntrada:
          f.multiplicadorEntrada == null
            ? null
            : typeof f.multiplicadorEntrada === 'number'
              ? f.multiplicadorEntrada
              : Number(f.multiplicadorEntrada),
      })),
    })

    if (item.modoQuantidade === 'CX') {
      const validacao = validarQuantidadeModoCx(item.quantidadeInformada)
      if (!validacao.ok) {
        throw new ErroDaAplicacao(validacao.mensagem, 400)
      }
    } else {
      // No backend, só bloqueia fracionamento indevido.
      // Fora do múltiplo: o front sugere adequação; o usuário pode seguir sem ajuste.
      if (
        !produto.permiteVendaFracionada &&
        Math.abs(item.quantidadeInformada - Math.round(item.quantidadeInformada)) >= 1e-9
      ) {
        throw new ErroDaAplicacao('Este produto não permite venda fracionada.', 400)
      }
    }

    const quantidadeUnidadeVenda = converterQtdParaUnidadeVenda(
      item.modoQuantidade,
      item.quantidadeInformada,
      itensNaCaixa
    )
    const total = Math.round(quantidadeUnidadeVenda * item.precoUnitario * 100) / 100

    return {
      produtoId: item.produtoId,
      modoQuantidade: item.modoQuantidade,
      quantidadeInformada: item.quantidadeInformada,
      quantidadeUnidadeVenda,
      itensPorEmbalagem: itensNaCaixa,
      unidade: produto.unidade,
      precoUnitario: item.precoUnitario,
      total,
      ordem: item.ordem ?? ordem,
    }
  })
}

async function listarPedidosVenda(companyId: string, busca?: string) {
  return repositorioDePedidosVenda.listar(companyId, busca)
}

async function buscarPedidoVenda(id: string, companyId: string) {
  const pedido = await repositorioDePedidosVenda.buscarPorId(id, companyId)
  if (!pedido) {
    throw new ErroDaAplicacao('Pedido de venda não encontrado', 404)
  }
  return pedido
}

async function criarPedidoVenda(
  dados: DadosParaCriarPedidoVenda,
  companyId: string,
  idDoAutor: string
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  const mapa = await carregarProdutosDosItens(dados.itens, companyId)
  const itens = calcularItens(dados.itens, mapa)
  const status = dados.concluir ? 'concluido' : 'rascunho'
  const pedido = await repositorioDePedidosVenda.criar(dados, itens, companyId, status)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'pedido_venda',
    entidadeId: pedido.id,
    valoresDepois: { numero: pedido.numero, status: pedido.status },
  })

  return pedido
}

async function editarPedidoVenda(
  id: string,
  dados: DadosParaEditarPedidoVenda,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDePedidosVenda.buscarPorId(id, companyId)
  if (!existente) {
    throw new ErroDaAplicacao('Pedido de venda não encontrado', 404)
  }
  if (existente.status !== 'rascunho' && existente.status !== 'aberto') {
    throw new ErroDaAplicacao('Somente rascunho pode ser editado', 400)
  }

  const mapa = await carregarProdutosDosItens(dados.itens, companyId)
  const itens = calcularItens(dados.itens, mapa)
  const status = dados.concluir ? 'concluido' : 'rascunho'
  const pedido = await repositorioDePedidosVenda.atualizar(id, dados, itens, companyId, status)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'pedido_venda',
    entidadeId: pedido.id,
    valoresDepois: { numero: pedido.numero, status: pedido.status },
  })

  return pedido
}

async function cancelarPedidoVenda(id: string, companyId: string, idDoAutor: string) {
  const ok = await repositorioDePedidosVenda.cancelar(id, companyId)
  if (!ok) {
    throw new ErroDaAplicacao('Pedido não encontrado ou não pode ser cancelado', 400)
  }

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'cancelar',
    entidade: 'pedido_venda',
    entidadeId: id,
    valoresDepois: { status: 'cancelado' },
  })

  return buscarPedidoVenda(id, companyId)
}

export const servicoDePedidosVenda = {
  listarPedidosVenda,
  buscarPedidoVenda,
  criarPedidoVenda,
  editarPedidoVenda,
  cancelarPedidoVenda,
}
