/**
 * Rotas HTTP do módulo de usuários.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { controladorDeUsuarios } from './controlador-usuarios.js'

/**
 * Registra rotas de criar, listar, editar e desativar usuários.
 */
export async function rotasDeUsuarios(
  aplicacao: FastifyInstance
): Promise<void> {
  aplicacao.post(
    '/',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:create'),
      ],
    },
    controladorDeUsuarios.criarUsuario
  )

  aplicacao.get(
    '/',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:view'),
      ],
    },
    controladorDeUsuarios.listarUsuarios
  )

  aplicacao.get(
    '/:id',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:view'),
      ],
    },
    controladorDeUsuarios.buscarUsuarioPorId
  )

  aplicacao.put(
    '/:id',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:edit'),
      ],
    },
    controladorDeUsuarios.editarUsuario
  )

  aplicacao.patch(
    '/:id/ativo',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:edit'),
      ],
    },
    controladorDeUsuarios.alterarStatusDoUsuario
  )
}
