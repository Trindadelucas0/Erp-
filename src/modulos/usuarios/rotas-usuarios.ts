/**
 * Rotas HTTP do módulo de usuários.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
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
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDeUsuarios.criarUsuario
  )

  aplicacao.get(
    '/',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDeUsuarios.listarUsuarios
  )

  aplicacao.get(
    '/:id',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDeUsuarios.buscarUsuarioPorId
  )

  aplicacao.put(
    '/:id',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDeUsuarios.editarUsuario
  )

  aplicacao.patch(
    '/:id/ativo',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDeUsuarios.alterarStatusDoUsuario
  )

  aplicacao.patch(
    '/:id/senha',
    {
      preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin],
    },
    controladorDeUsuarios.resetarSenha
  )
}
