/**
 * Middleware que valida o JWT em cada requisição protegida.
 * Se o token for válido, salva o idDoUsuario na requisição.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { verificarTokenDeAutenticacao } from '../../compartilhado/utilitarios/token-jwt.js'

/**
 * Intercepta a requisição e verifica o token JWT.
 * @param requisicao - Dados da requisição HTTP
 * @param _resposta - Objeto de resposta (não usado aqui)
 * @returns void — em caso de erro, lança ErroDaAplicacao
 */
export async function middlewareDeAutenticacao(
  requisicao: FastifyRequest,
  _resposta: FastifyReply
): Promise<void> {
  try {
    const idDoUsuario = await verificarTokenDeAutenticacao(requisicao)
    requisicao.idDoUsuario = idDoUsuario
  } catch {
    throw new ErroDaAplicacao('Token inválido ou expirado', 401)
  }
}
