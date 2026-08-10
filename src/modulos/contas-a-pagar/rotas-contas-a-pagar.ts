import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeContasAPagar } from './controlador-contas-a-pagar.js'

export async function rotasDeContasAPagar(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAPagar.listar
  )

  aplicacao.get(
    '/para-baixar',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAPagar.listarParaBaixar
  )

  aplicacao.post(
    '/baixas',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAPagar.baixar
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAPagar.obter
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:create')] },
    controladorDeContasAPagar.criar
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAPagar.editar
  )

  aplicacao.delete(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAPagar.excluir
  )
}
