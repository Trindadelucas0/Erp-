/**
 * Rotas HTTP do módulo de páginas.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
import { controladorDePaginas } from './controlador-paginas.js'

export async function rotasDePaginas(
  aplicacao: FastifyInstance
): Promise<void> {
  aplicacao.get(
    '/vinculaveis',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDePaginas.listarPaginasVinculaveis
  )
}
