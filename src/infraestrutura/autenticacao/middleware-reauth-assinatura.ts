/**
 * Middleware que exige um token de reautenticação de curta duração para
 * rotas de documentos de assinatura. O token é emitido por
 * POST /auth/verificar-senha com escopo 'assinatura-documentos' e deve
 * ser enviado no cabeçalho X-Reauth-Token.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  ConteudoDoTokenReauth,
  ESCOPO_REAUTH_ASSINATURA,
} from '../../compartilhado/utilitarios/token-jwt.js'

export async function middlewareReauthAssinatura(
  requisicao: FastifyRequest,
  _resposta: FastifyReply
): Promise<void> {
  const tokenReauth = requisicao.headers['x-reauth-token']

  if (!tokenReauth || typeof tokenReauth !== 'string') {
    throw new ErroDaAplicacao(
      'Confirme sua senha de administrador para acessar documentos de assinatura',
      403
    )
  }

  let conteudo: ConteudoDoTokenReauth
  try {
    conteudo = requisicao.server.jwt.verify<ConteudoDoTokenReauth>(tokenReauth)
  } catch {
    throw new ErroDaAplicacao(
      'Token de confirmação de senha inválido ou expirado. Confirme sua senha novamente.',
      403
    )
  }

  if (
    conteudo.tipo !== 'reauth-assinatura' ||
    conteudo.escopo !== ESCOPO_REAUTH_ASSINATURA
  ) {
    throw new ErroDaAplicacao('Token de confirmação inválido para esta ação', 403)
  }

  if (conteudo.idDoUsuario !== requisicao.idDoUsuario) {
    throw new ErroDaAplicacao('Token de confirmação não pertence ao usuário autenticado', 403)
  }
}
