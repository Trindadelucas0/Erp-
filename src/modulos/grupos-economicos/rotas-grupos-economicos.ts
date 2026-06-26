import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeGruposEconomicos } from './controlador-grupos-economicos.js'

export async function rotasDeGruposEconomicos(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get('/', { preHandler: auth }, controladorDeGruposEconomicos.listar)
  aplicacao.post('/', { preHandler: auth }, controladorDeGruposEconomicos.criar)
}
