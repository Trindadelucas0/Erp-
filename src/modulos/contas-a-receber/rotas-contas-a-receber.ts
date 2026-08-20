import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
import { controladorDeContasAReceber } from './controlador-contas-a-receber.js'

export async function rotasDeContasAReceber(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAReceber.listar
  )

  aplicacao.get(
    '/para-baixar',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAReceber.listarParaBaixar
  )

  aplicacao.get(
    '/historico-baixas',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAReceber.listarHistoricoBaixas
  )

  aplicacao.post(
    '/baixas',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAReceber.baixar
  )

  aplicacao.get(
    '/:id/anexos',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAReceber.listarAnexos
  )

  aplicacao.post(
    '/:id/anexos',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAReceber.enviarAnexo
  )

  aplicacao.get(
    '/:id/anexos/:anexoId/download',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAReceber.baixarAnexo
  )

  aplicacao.delete(
    '/:id/anexos/:anexoId',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAReceber.excluirAnexo
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContasAReceber.obter
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:create')] },
    controladorDeContasAReceber.criar
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContasAReceber.editar
  )

  aplicacao.delete(
    '/:id',
    { preHandler: [...auth, middlewareSomenteAdmin] },
    controladorDeContasAReceber.excluir
  )
}
