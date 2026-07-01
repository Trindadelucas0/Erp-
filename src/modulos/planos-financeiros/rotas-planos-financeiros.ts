import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDePlanosFinanceiros } from './controlador-planos-financeiros.js'

export async function rotasDePlanosFinanceiros(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/proximo-codigo',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDePlanosFinanceiros.sugerirProximoCodigo
  )

  aplicacao.get(
    '/',
    { preHandler: auth },
    controladorDePlanosFinanceiros.listarPlanosFinanceiros
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDePlanosFinanceiros.buscarPlanoFinanceiro
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:create')] },
    controladorDePlanosFinanceiros.criarPlanoFinanceiro
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDePlanosFinanceiros.editarPlanoFinanceiro
  )

  aplicacao.patch(
    '/:id/ativo',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:delete')] },
    controladorDePlanosFinanceiros.alterarStatusDoPlanoFinanceiro
  )

  aplicacao.patch(
    '/:id/mover',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDePlanosFinanceiros.moverPlanoFinanceiro
  )
}
