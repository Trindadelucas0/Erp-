/**
 * Rotas de integrações externas (proxy BrasilAPI, etc.).
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeIntegracoes } from './controlador-integracoes.js'

export async function rotasDeIntegracoes(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/cnpj/:documento',
    { preHandler: auth },
    controladorDeIntegracoes.consultarCnpj
  )
}
