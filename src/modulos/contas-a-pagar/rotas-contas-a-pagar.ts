import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
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

  aplicacao.get(
    '/historico-baixas',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAPagar.listarHistoricoBaixas
  )

  aplicacao.post(
    '/baixas',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAPagar.baixar
  )

  aplicacao.get(
    '/:id/anexos',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAPagar.listarAnexos
  )

  aplicacao.post(
    '/:id/anexos',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAPagar.enviarAnexo
  )

  aplicacao.get(
    '/:id/anexos/:anexoId/download',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAPagar.baixarAnexo
  )

  aplicacao.delete(
    '/:id/anexos/:anexoId',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAPagar.excluirAnexo
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
    { preHandler: [...auth, middlewareSomenteAdmin] },
    controladorDeContasAPagar.excluir
  )
}
