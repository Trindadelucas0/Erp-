/**
 * Rotas HTTP do módulo de pedidos de venda.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDePedidosVenda } from './controlador-pedidos-venda.js'

export async function rotasDePedidosVenda(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] },
    controladorDePedidosVenda.listar
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] },
    controladorDePedidosVenda.buscar
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] },
    controladorDePedidosVenda.criar
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] },
    controladorDePedidosVenda.editar
  )

  aplicacao.patch(
    '/:id/cancelar',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] },
    controladorDePedidosVenda.cancelar
  )
}
