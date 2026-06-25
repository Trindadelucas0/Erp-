/**
 * Configurações e funções auxiliares do JWT.
 * O token carrega idDoUsuario e tokenVersion — permissões ficam no banco.
 */
import { FastifyReply, FastifyRequest } from 'fastify'

/** Tempo de expiração padrão do token (8 horas). */
export const TEMPO_DE_EXPIRACAO_DO_TOKEN = '8h'

/** Tempo de expiração do token de reautenticação para seções sensíveis (15 minutos). */
export const TEMPO_DE_EXPIRACAO_DO_TOKEN_REAUTH = '15m'

/** Escopo válido para tokens de reautenticação. */
export const ESCOPO_REAUTH_ASSINATURA = 'assinatura-documentos' as const

/** Formato do conteúdo dentro do token JWT. */
export type ConteudoDoToken = {
  idDoUsuario: string
  tokenVersion: number
}

/** Formato do token de curta duração emitido após confirmação de senha. */
export type ConteudoDoTokenReauth = {
  tipo: 'reauth-assinatura'
  escopo: typeof ESCOPO_REAUTH_ASSINATURA
  idDoUsuario: string
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

/**
 * Emite um token de curta duração após confirmação de senha para seções sensíveis.
 * @param resposta - Objeto reply do Fastify
 * @param idDoUsuario - ID do usuário autenticado
 * @returns Token reauth assinado
 */
export async function gerarTokenDeReautenticacao(
  resposta: FastifyReply,
  idDoUsuario: string
): Promise<string> {
  const payload: ConteudoDoTokenReauth = {
    tipo: 'reauth-assinatura',
    escopo: ESCOPO_REAUTH_ASSINATURA,
    idDoUsuario,
  }
  return resposta.jwtSign(payload, { expiresIn: TEMPO_DE_EXPIRACAO_DO_TOKEN_REAUTH })
}
