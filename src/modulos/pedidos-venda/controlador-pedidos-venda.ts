/**
 * Controlador HTTP de pedidos de venda.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  esquemaDeCriacaoDePedidoVenda,
  esquemaDeEdicaoDePedidoVenda,
  mensagemErroZod,
} from './esquema-pedidos-venda.js'
import { servicoDePedidosVenda } from './servico-pedidos-venda.js'

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const { busca } = requisicao.query as { busca?: string }
  const pedidos = await servicoDePedidosVenda.listarPedidosVenda(companyId, busca)
  return resposta.send({ pedidos })
}

async function buscar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosVenda.buscarPedidoVenda(id, companyId)
  return resposta.send({ pedido })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDePedidoVenda.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosVenda.criarPedidoVenda(
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ pedido })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDePedidoVenda.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosVenda.editarPedidoVenda(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ pedido })
}

async function cancelar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const pedido = await servicoDePedidosVenda.cancelarPedidoVenda(
    id,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ pedido })
}

export const controladorDePedidosVenda = {
  listar,
  buscar,
  criar,
  editar,
  cancelar,
}
