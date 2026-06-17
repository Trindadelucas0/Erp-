/**
 * Rotas HTTP do módulo de clientes.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeClientes } from './controlador-clientes.js'

export async function rotasDeClientes(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('clientes:view')] },
    controladorDeClientes.listarClientes
  )

  // Deve ficar antes de /:id para não ser interceptada como parâmetro
  aplicacao.get(
    '/por-documento/:documento',
    { preHandler: [...auth, middlewareDeAutorizacao('clientes:view')] },
    controladorDeClientes.buscarClientePorDocumento
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('clientes:create')] },
    controladorDeClientes.criarCliente
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('clientes:edit')] },
    controladorDeClientes.editarCliente
  )

  aplicacao.patch(
    '/:id/ativo',
    { preHandler: [...auth, middlewareDeAutorizacao('clientes:delete')] },
    controladorDeClientes.alterarStatusDoCliente
  )
}
