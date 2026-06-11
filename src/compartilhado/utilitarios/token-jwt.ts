/**
 * Configurações e funções auxiliares do JWT.
 * O token carrega apenas o idDoUsuario — permissões ficam no banco.
 */
import { FastifyReply, FastifyRequest } from 'fastify'

/** Tempo de expiração padrão do token (7 dias). */
export const TEMPO_DE_EXPIRACAO_DO_TOKEN = '7d'

/** Formato do conteúdo dentro do token JWT. */
export type ConteudoDoToken = {
  idDoUsuario: string
}

/**
 * Gera o token JWT após login bem-sucedido.
 * @param resposta - Objeto reply do Fastify
 * @param idDoUsuario - ID do usuário autenticado
 * @returns Token assinado em string
 */
export async function gerarTokenDeAutenticacao(
  resposta: FastifyReply,
  idDoUsuario: string
): Promise<string> {
  return resposta.jwtSign({ idDoUsuario })
}

/**
 * Verifica se o token JWT é válido e extrai o idDoUsuario.
 * @param requisicao - Objeto request do Fastify
 * @returns ID do usuário contido no token
 */
export async function verificarTokenDeAutenticacao(
  requisicao: FastifyRequest
): Promise<string> {
  const conteudo = await requisicao.jwtVerify<ConteudoDoToken>()
  return conteudo.idDoUsuario
}
