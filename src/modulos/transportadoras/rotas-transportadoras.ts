/**
 * Rotas HTTP do módulo de transportadoras.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeTransportadoras } from './controlador-transportadoras.js'

export async function rotasDeTransportadoras(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('transportadoras:view')] },
    controladorDeTransportadoras.listarTransportadoras
  )

  aplicacao.get(
    '/por-documento/:documento',
    { preHandler: [...auth, middlewareDeAutorizacao('transportadoras:view')] },
    controladorDeTransportadoras.buscarTransportadoraPorDocumento
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('transportadoras:create')] },
    controladorDeTransportadoras.criarTransportadora
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('transportadoras:edit')] },
    controladorDeTransportadoras.editarTransportadora
  )

  aplicacao.patch(
    '/:id/ativo',
    { preHandler: [...auth, middlewareDeAutorizacao('transportadoras:delete')] },
    controladorDeTransportadoras.alterarStatusDaTransportadora
  )
}
