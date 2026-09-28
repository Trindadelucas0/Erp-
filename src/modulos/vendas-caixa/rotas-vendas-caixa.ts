import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { esquemaConfirmarPagamento } from './esquema-vendas-caixa.js'
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
  const vendas = await servicoDeVendasCaixa.listar(companyIdDaSessao(requisicao))
  return resposta.send({ vendas })
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

export async function rotasDeVendasCaixa(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]
  aplicacao.get('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] }, listar)
  aplicacao.post('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] }, confirmar)
}
