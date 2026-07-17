/**
 * Rotas HTTP do módulo de auditoria.
 */
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
import { repositorioDeAuditoria } from './repositorio-auditoria.js'

export async function rotasDeAuditoria(aplicacao: FastifyInstance): Promise<void> {
  aplicacao.get(
    '/',
    { preHandler: [middlewareDeAutenticacao, middlewareSomenteAdmin] },
    async (requisicao: FastifyRequest, resposta: FastifyReply) => {
      const { entidade, usuarioId, dataInicio, dataFim, pagina, limite } =
        requisicao.query as {
          entidade?: string
          usuarioId?: string
          dataInicio?: string
          dataFim?: string
          pagina?: string
          limite?: string
        }

      const filtros = {
        entidade,
        usuarioId,
        dataInicio: dataInicio ? new Date(dataInicio) : undefined,
        dataFim: dataFim ? new Date(dataFim) : undefined,
        pagina: pagina ? parseInt(pagina, 10) : 1,
        limite: limite ? parseInt(limite, 10) : undefined,
      }

      const [logs, total] = await Promise.all([
        repositorioDeAuditoria.listar(filtros),
        repositorioDeAuditoria.contarTotal(filtros),
      ])

      return resposta.send({
        logs,
        total,
        limite: repositorioDeAuditoria.normalizarLimite(filtros.limite),
      })
    }
  )
}
