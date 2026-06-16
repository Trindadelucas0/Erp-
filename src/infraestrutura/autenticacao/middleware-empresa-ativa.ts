/**
 * Middleware opcional que lê o header X-Company-Id e valida se o usuário
 * está vinculado à empresa informada. Seta requisicao.empresaAtivaId.
 * Usar em rotas que precisam saber qual empresa está operando.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { usuarioEhAdmin } from '../../compartilhado/paginas/registro-de-paginas.js'
import { repositorioDeUsuarios } from '../../modulos/usuarios/repositorio-usuarios.js'

export async function middlewareEmpresaAtiva(
  requisicao: FastifyRequest,
  _resposta: FastifyReply
): Promise<void> {
  const idDoUsuario = requisicao.idDoUsuario
  const empresaAtivaId = requisicao.headers['x-company-id'] as string | undefined

  if (!idDoUsuario || !empresaAtivaId) return

  const usuario = await repositorioDeUsuarios.buscarPorId(idDoUsuario)
  if (!usuario) return

  if (usuarioEhAdmin(usuario.roles)) {
    const empresa = await clientePrisma.company.findUnique({
      where: { id: empresaAtivaId },
      select: { id: true },
    })
    if (!empresa) {
      throw new ErroDaAplicacao('Empresa não encontrada', 404)
    }
    requisicao.empresaAtivaId = empresaAtivaId
    return
  }

  const vinculo = await clientePrisma.userCompany.findUnique({
    where: { userId_companyId: { userId: idDoUsuario, companyId: empresaAtivaId } },
  })

  if (!vinculo) {
    throw new ErroDaAplicacao('Sem acesso a esta empresa', 403)
  }

  requisicao.empresaAtivaId = empresaAtivaId
}
