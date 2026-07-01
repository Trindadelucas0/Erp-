import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeCatalogos } from './controlador-catalogos.js'

/** Rotas legadas de catálogo — mantidas para compatibilidade se necessário. */
export async function rotasDeCatalogos(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]
  aplicacao.get('/cfops-catalogo', { preHandler: auth }, controladorDeCatalogos.listarCfops)
}
