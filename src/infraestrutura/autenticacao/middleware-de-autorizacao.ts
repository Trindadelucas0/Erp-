/**
 * Middleware que verifica se o usuário tem permissão para acessar a rota.
 * Consulta o banco — permissões NÃO ficam dentro do JWT.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDePermissoes } from '../../modulos/permissoes/repositorio-permissoes.js'

/**
 * Cria um middleware que exige uma permissão específica.
 * @param chaveDaPermissao - Ex: "configuracoes:view"
 * @returns Função middleware para usar no preHandler da rota
 */
export function middlewareDeAutorizacao(chaveDaPermissao: string) {
  return async function (
    requisicao: FastifyRequest,
    _resposta: FastifyReply
  ): Promise<void> {
    const idDoUsuario = requisicao.idDoUsuario

    if (!idDoUsuario) {
      throw new ErroDaAplicacao('Não autenticado', 401)
    }

    const usuarioTemPermissao = await repositorioDePermissoes.usuarioPossuiPermissao(
      idDoUsuario,
      chaveDaPermissao
    )

    if (!usuarioTemPermissao) {
      throw new ErroDaAplicacao('Sem permissão para esta ação', 403)
    }
  }
}

/**
 * Exige ao menos uma das permissões informadas.
 */
export function middlewareDeAutorizacaoQualquer(...chavesDaPermissao: string[]) {
  return async function (
    requisicao: FastifyRequest,
    _resposta: FastifyReply
  ): Promise<void> {
    const idDoUsuario = requisicao.idDoUsuario

    if (!idDoUsuario) {
      throw new ErroDaAplicacao('Não autenticado', 401)
    }

    for (const chave of chavesDaPermissao) {
      const usuarioTemPermissao = await repositorioDePermissoes.usuarioPossuiPermissao(
        idDoUsuario,
        chave
      )
      if (usuarioTemPermissao) return
    }

    throw new ErroDaAplicacao('Sem permissão para esta ação', 403)
  }
}
