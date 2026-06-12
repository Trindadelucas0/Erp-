/**
 * Rotas HTTP do módulo de empresas.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { controladorDeEmpresas } from './controlador-empresas.js'

/**
 * Registra rotas de CRUD de empresas (módulo cadastros).
 */
export async function rotasDeEmpresas(
  aplicacao: FastifyInstance
): Promise<void> {
  aplicacao.get(
    '/',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('cadastros:view'),
      ],
    },
    controladorDeEmpresas.listarEmpresas
  )

  aplicacao.post(
    '/',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('cadastros:create'),
      ],
    },
    controladorDeEmpresas.criarEmpresa
  )

  aplicacao.put(
    '/:id',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('cadastros:edit'),
      ],
    },
    controladorDeEmpresas.editarEmpresa
  )

  aplicacao.patch(
    '/:id/ativo',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('cadastros:delete'),
      ],
    },
    controladorDeEmpresas.alterarStatusDaEmpresa
  )
}
