/**
 * Tipos extras para o Fastify.
 * Adiciona idDoUsuario e empresaAtivaId na requisição após autenticação.
 */
import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    idDoUsuario?: string
    empresaAtivaId?: string
    /** Mensagem de erro anexada ao log HTTP em desenvolvimento */
    logErroMensagem?: string
  }
}
