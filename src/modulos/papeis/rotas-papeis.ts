/**
 * Rotas HTTP do módulo de papéis (roles).
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { controladorDePapeis } from './controlador-papeis.js'

/**
 * Registra rotas de listagem e gestão de permissões dos papéis.
 */
export async function rotasDePapeis(
  aplicacao: FastifyInstance
): Promise<void> {
  aplicacao.get(
    '/',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:view'),
      ],
    },
    controladorDePapeis.listarPapeis
  )

  aplicacao.get(
    '/:id',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:view'),
      ],
    },
    controladorDePapeis.buscarPapelPorId
  )

  aplicacao.put(
    '/:id/permissoes',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:edit'),
      ],
    },
    controladorDePapeis.salvarPermissoesDoPapel
  )
}
