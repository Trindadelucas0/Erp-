/**
 * Configurações e funções auxiliares do JWT.
 * O token carrega idDoUsuario e tokenVersion — permissões ficam no banco.
 */
import { FastifyReply, FastifyRequest } from 'fastify'

/** Tempo de expiração padrão do token (8 horas). */
export const TEMPO_DE_EXPIRACAO_DO_TOKEN = '8h'

/** Formato do conteúdo dentro do token JWT. */
export type ConteudoDoToken = {
  idDoUsuario: string
  tokenVersion: number
}

/**
 * Gera o token JWT após login bem-sucedido.
 * @param resposta - Objeto reply do Fastify
 * @param idDoUsuario - ID do usuário autenticado
 * @param tokenVersion - Versão atual do token do usuário
 * @returns Token assinado em string
 */
export async function gerarTokenDeAutenticacao(
  resposta: FastifyReply,
  idDoUsuario: string,
  tokenVersion: number
): Promise<string> {
  return resposta.jwtSign({ idDoUsuario, tokenVersion })
}

/**
 * Verifica se o token JWT é válido e extrai o conteúdo.
 * @param requisicao - Objeto request do Fastify
 * @returns Conteúdo do token (idDoUsuario + tokenVersion)
 */
export async function verificarTokenDeAutenticacao(
  requisicao: FastifyRequest
): Promise<ConteudoDoToken> {
  return requisicao.jwtVerify<ConteudoDoToken>()
}
