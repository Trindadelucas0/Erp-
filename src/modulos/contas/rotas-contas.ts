import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeContas } from './controlador-contas.js'

export async function rotasDeContas(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContas.listar
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorDeContas.obter
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:create')] },
    controladorDeContas.criar
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContas.editar
  )

  aplicacao.patch(
    '/:id/ativo',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorDeContas.alterarStatus
  )
}
