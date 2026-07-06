/**
 * Controlador de pedidos de compra.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDePedidosCompra } from './servico-pedidos-compra.js'
import {
  esquemaCancelarPedidoCompra,
  esquemaCompararPdf,
  esquemaConferenciaEntrada,
  esquemaDeCriacaoDePedidoCompra,
  esquemaDeEdicaoDePedidoCompra,
} from './esquema-pedidos-compra.js'

async function listarPedidosCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const { fornecedorId, status, statusAberto, numero, busca, dataInicio, dataFim } =
    requisicao.query as {
      fornecedorId?: string
      status?: string
      statusAberto?: string
      numero?: string
      busca?: string
      dataInicio?: string
      dataFim?: string
    }

  let numeroFiltro: number | undefined
  if (numero != null && numero.trim() !== '') {
    const n = Number(numero.replace(/^#/, '').trim())
    if (!Number.isInteger(n) || n <= 0) {
      throw new ErroDaAplicacao('Número do pedido inválido', 400)
    }
    numeroFiltro = n
  }

  let inicio: Date | undefined
  let fim: Date | undefined
  if (dataInicio) {
    inicio = new Date(`${dataInicio}T00:00:00`)
    if (Number.isNaN(inicio.getTime())) {
      throw new ErroDaAplicacao('Data inicial inválida', 400)
    }
  }
  if (dataFim) {
    fim = new Date(`${dataFim}T23:59:59.999`)
    if (Number.isNaN(fim.getTime())) {
      throw new ErroDaAplicacao('Data final inválida', 400)
    }
  }

  const pedidos = await servicoDePedidosCompra.listarPedidosCompra(companyId, {
    fornecedorId,
    status,
    statusAberto: statusAberto === 'true',
    numero: numeroFiltro,
    busca: busca?.trim() || undefined,
    dataInicio: inicio,
    dataFim: fim,
  })
  return resposta.send({ pedidos })
}

async function buscarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.buscarPedidoCompra(id, companyId)
  return resposta.send({ pedido })
}

async function criarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDePedidoCompra.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.criarPedidoCompra(
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ pedido })
}

async function copiarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.copiarPedidoCompra(
    id,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ pedido })
}

async function editarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDePedidoCompra.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.editarPedidoCompra(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ pedido })
}

async function cancelarPedidoCompra(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaCancelarPedidoCompra.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosCompra.cancelarPedidoCompra(
    id,
    resultado.data.motivo,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ pedido })
}

async function contextoFornecedor(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { fornecedorId } = requisicao.params as { fornecedorId: string }
  const companyId = requisicao.empresaAtivaId || ''
  const contexto = await servicoDePedidosCompra.obterContextoFornecedor(fornecedorId, companyId)
  return resposta.send(contexto)
}

async function conferirEntrada(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaConferenciaEntrada.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const conferencia = await servicoDePedidosCompra.conferirComEntrada(
    id,
    resultado.data,
    companyId
  )
  return resposta.send(conferencia)
}

async function compararPdf(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaCompararPdf.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const comparacao = await servicoDePedidosCompra.compararComPdf(
    id,
    resultado.data.base64Pdf,
    companyId
  )
  return resposta.send(comparacao)
}

async function historicoProduto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { produtoId } = requisicao.params as { produtoId: string }
  const companyId = requisicao.empresaAtivaId || ''
  const historico = await servicoDePedidosCompra.historicoProduto(produtoId, companyId)
  return resposta.send({ historico })
}

async function listarPedidosVendaEncomenda(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { busca } = requisicao.query as { busca?: string }
  const companyId = requisicao.empresaAtivaId || ''
  const pedidos = await servicoDePedidosCompra.listarPedidosVendaEncomenda(companyId, busca)
  return resposta.send({ pedidos })
}

export const controladorDePedidosCompra = {
  listarPedidosCompra,
  buscarPedidoCompra,
  criarPedidoCompra,
  copiarPedidoCompra,
  editarPedidoCompra,
  cancelarPedidoCompra,
  contextoFornecedor,
  conferirEntrada,
  compararPdf,
  historicoProduto,
  listarPedidosVendaEncomenda,
}
