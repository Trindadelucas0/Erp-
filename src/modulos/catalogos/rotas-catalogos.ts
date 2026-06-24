import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeCatalogos } from './controlador-catalogos.js'

export async function rotasDeCatalogos(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get('/planos-financeiros', { preHandler: auth }, controladorDeCatalogos.listarPlanosFinanceiros)
  aplicacao.get('/cfops', { preHandler: auth }, controladorDeCatalogos.listarCfops)
}
