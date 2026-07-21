/**
 * Middleware que valida o JWT em cada requisição protegida.
 * Verifica também o tokenVersion para invalidar tokens de usuários desativados.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { verificarTokenDeAutenticacao } from '../../compartilhado/utilitarios/token-jwt.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

export async function middlewareDeAutenticacao(
  requisicao: FastifyRequest,
  _resposta: FastifyReply
): Promise<void> {
  
  try {
    const { idDoUsuario, tokenVersion } = await verificarTokenDeAutenticacao(requisicao)

    const usuario = await clientePrisma.user.findUnique({
      where: { id: idDoUsuario },
      select: { id: true, active: true, tokenVersion: true },
    })

    if (!usuario || !usuario.active) {
      throw new ErroDaAplicacao('Usuário inativo ou não encontrado', 401)
    }

    if (usuario.tokenVersion !== tokenVersion) {
      throw new ErroDaAplicacao('Sessão inválida. Faça login novamente.', 401)
    }

    requisicao.idDoUsuario = idDoUsuario
  } catch (erro) {
    if (erro instanceof ErroDaAplicacao) throw erro
    throw new ErroDaAplicacao('Token inválido ou expirado', 401)
  }
}
