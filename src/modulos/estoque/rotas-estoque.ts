/**
 * Rotas HTTP do módulo de estoque / Kardex (Fase 1).
 * Sem update/delete de movimento — append-only.
 */
import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeEstoque } from './controlador-estoque.js'

export async function rotasDeEstoque(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:view')] },
    controladorDeEstoque.listarEstoque
  )

  aplicacao.get(
    '/kardex',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:view')] },
    controladorDeEstoque.obterKardex
  )

  aplicacao.get(
    '/:produtoId/saldos',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:view')] },
    controladorDeEstoque.obterSaldosProduto
  )

  aplicacao.post(
    '/:produtoId/ajuste-inventario',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:edit')] },
    controladorDeEstoque.ajusteInventario
  )
}
