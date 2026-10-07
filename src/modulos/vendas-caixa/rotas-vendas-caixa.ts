import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import {
  esquemaChamarAtendente,
  esquemaConfirmarChamado,
  esquemaConfirmarPagamento,
} from './esquema-vendas-caixa.js'
import { servicoDeVendasCaixa } from './servico-vendas-caixa.js'

function companyIdDaSessao(requisicao: FastifyRequest): string {
  const companyId = requisicao.empresaAtivaId
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa obrigatória', 400)
  return companyId
}

function usuarioIdDaSessao(requisicao: FastifyRequest): string {
  const usuarioId = requisicao.idDoUsuario
  if (!usuarioId) throw new ErroDaAplicacao('Não autenticado', 401)
  return usuarioId
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const lista = await servicoDeVendasCaixa.listar(companyIdDaSessao(requisicao))
  return resposta.send(lista)
}

async function confirmar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const corpo = esquemaConfirmarPagamento.safeParse(requisicao.body)
  if (!corpo.success) {
    throw new ErroDaAplicacao(corpo.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const venda = await servicoDeVendasCaixa.confirmarPagamento(
    companyIdDaSessao(requisicao),
    usuarioIdDaSessao(requisicao),
    corpo.data
  )
  return resposta.status(201).send({ venda })
}

async function chamar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const corpo = esquemaChamarAtendente.safeParse(requisicao.body)
  if (!corpo.success) {
    throw new ErroDaAplicacao(corpo.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const venda = await servicoDeVendasCaixa.chamarAtendente(
    companyIdDaSessao(requisicao),
    corpo.data
  )
  return resposta.status(201).send({ venda })
}

async function confirmarChamado(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  if (!id) throw new ErroDaAplicacao('Venda não encontrada', 404)
  const corpo = esquemaConfirmarChamado.safeParse(requisicao.body)
  if (!corpo.success) {
    throw new ErroDaAplicacao(corpo.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const venda = await servicoDeVendasCaixa.confirmarChamado(
    companyIdDaSessao(requisicao),
    usuarioIdDaSessao(requisicao),
    id,
    corpo.data
  )
  return resposta.send({ venda })
}

export async function rotasDeVendasCaixa(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]
  aplicacao.get('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] }, listar)
  aplicacao.post('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] }, confirmar)
  aplicacao.post(
    '/chamar',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] },
    chamar
  )
  aplicacao.post(
    '/:id/confirmar',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] },
    confirmarChamado
  )
}
