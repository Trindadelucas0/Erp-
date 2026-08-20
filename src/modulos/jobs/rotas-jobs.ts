/**
 * Consulta de status de job (poll das telas).
 * Prefixo: /jobs
 */
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoJobs } from '../../compartilhado/jobs/servico-jobs.js'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'

async function statusJob(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)
  const { id } = requisicao.params as { id: string }
  const job = await servicoJobs.statusJob(companyId, id)
  return resposta.send({ job })
}

export async function rotasJobs(aplicacao: FastifyInstance): Promise<void> {
  const autenticado = [middlewareDeAutenticacao, middlewareEmpresaAtiva]
  aplicacao.get('/:id', { preHandler: autenticado }, statusJob)
}
