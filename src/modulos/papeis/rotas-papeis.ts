/**
 * Rotas HTTP do módulo de papéis (roles).
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
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
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDePapeis.listarPapeis
  )

  aplicacao.get(
    '/catalogo-telas',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDePapeis.listarCatalogoTelas
  )

  aplicacao.get(
    '/:id',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDePapeis.buscarPapelPorId
  )

  aplicacao.put(
    '/:id/permissoes',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDePapeis.salvarPermissoesDoPapel
  )

  aplicacao.put(
    '/:id/telas',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDePapeis.salvarTelasDoPapel
  )

  aplicacao.post(
    '/',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDePapeis.criarPapel
  )

  aplicacao.delete(
    '/:id',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDePapeis.excluirPapel
  )
}
