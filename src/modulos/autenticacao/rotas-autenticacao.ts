/**
 * Rotas HTTP do módulo de autenticação.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { controladorDeAutenticacao } from './controlador-autenticacao.js'

/**
 * Registra rotas de login e perfil do usuário logado.
 * @param aplicacao - Instância do servidor Fastify
 * @returns void
 */
export async function rotasDeAutenticacao(
  aplicacao: FastifyInstance
): Promise<void> {
  aplicacao.post('/login', controladorDeAutenticacao.fazerLogin)

  aplicacao.get(
    '/me',
    { preHandler: [middlewareDeAutenticacao] },
    controladorDeAutenticacao.buscarMeuPerfil
  )

  aplicacao.post(
    '/verificar-senha',
    { preHandler: [middlewareDeAutenticacao] },
    controladorDeAutenticacao.verificarSenha
  )
}
