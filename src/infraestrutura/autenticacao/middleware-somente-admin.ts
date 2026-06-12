/**
 * Middleware que exige papel admin.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { usuarioEhAdmin } from '../../compartilhado/paginas/registro-de-paginas.js'
import { repositorioDeUsuarios } from '../../modulos/usuarios/repositorio-usuarios.js'

export async function middlewareSomenteAdmin(
  requisicao: FastifyRequest,
  _resposta: FastifyReply
): Promise<void> {
  const idDoUsuario = requisicao.idDoUsuario

  if (!idDoUsuario) {
    throw new ErroDaAplicacao('Não autenticado', 401)
  }

  const usuario = await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuario || !usuarioEhAdmin(usuario.roles)) {
    throw new ErroDaAplicacao('Acesso restrito ao administrador', 403)
  }
}
