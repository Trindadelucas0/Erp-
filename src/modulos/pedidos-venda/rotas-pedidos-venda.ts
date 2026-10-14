import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { servicoPedidosVenda } from './servico-pedidos-venda.js'

function companyId(requisicao: FastifyRequest): string {
  if (!requisicao.empresaAtivaId) throw new ErroDaAplicacao('Empresa ativa obrigatória', 400)
  return requisicao.empresaAtivaId
}

export async function rotasPedidosVenda(aplicacao: FastifyInstance) {
  const auth = [
    middlewareDeAutenticacao,
    middlewareEmpresaAtiva,
    middlewareDeAutorizacao('vendas:view'),
  ]
  aplicacao.get('/', { preHandler: auth }, async (requisicao, resposta) => {
    return resposta.send({ pedidos: await servicoPedidosVenda.listar(companyId(requisicao)) })
  })
  aplicacao.get('/:id', { preHandler: auth }, async (requisicao, resposta) => {
    const id = z.string().uuid().safeParse((requisicao.params as { id?: string }).id)
    if (!id.success) throw new ErroDaAplicacao('Pedido de venda não encontrado', 404)
    return resposta.send({
      pedido: await servicoPedidosVenda.obter(companyId(requisicao), id.data),
    })
  })
}
