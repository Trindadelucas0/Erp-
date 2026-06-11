/**
 * Tipos extras para o Fastify.
 * Adiciona idDoUsuario na requisição após autenticação.
 */
import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    idDoUsuario?: string
  }
}
