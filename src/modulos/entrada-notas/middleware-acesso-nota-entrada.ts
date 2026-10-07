import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioFocusNfe } from '../focus-nfe/repositorio-focus-nfe.js'
import { exigirAcessoPainelEntradaNotas } from './servico-acesso-painel-entrada.js'

export async function middlewareAcessoNotaEntradaPorId(
  requisicao: FastifyRequest,
  _resposta: FastifyReply
): Promise<void> {
  const idDoUsuario = requisicao.idDoUsuario
  if (!idDoUsuario) {
    throw new ErroDaAplicacao('Não autenticado', 401)
  }

  const { id } = requisicao.params as { id?: string }
  if (!id) return

  const companyId = requisicao.empresaAtivaId
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada', 400)
  }

  const nota = await repositorioFocusNfe.buscarPorId(companyId, id)
  if (!nota) {
    throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  await exigirAcessoPainelEntradaNotas(idDoUsuario, {
    statusEntrada: nota.statusEntrada,
  })
}
