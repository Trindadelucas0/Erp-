/**
 * API interna da fila: enfileirar e consultar status.
 * As telas usam `POST` (202 + jobId) e depois `GET /jobs/:id` em poll.
 */
import { ErroDaAplicacao } from '../erros/ErroDaAplicacao.js'
import { repositorioJobs } from './repositorio-jobs.js'
import { acordarWorkerJobs } from './worker-jobs.js'
import type { JobView, TipoJob } from './tipos-job.js'

type DadosParaEnfileirar = {
  companyId: string
  tipo: TipoJob
  /** Alvo do job (ex.: `pedido:<id>`). Impede duplicar trabalho em andamento. */
  chaveDedupe?: string
  payload?: unknown
  maxTentativas?: number
  /** Mensagem do 409 quando já existe job ativo para a mesma chave. */
  mensagemConflito?: string
}

async function enfileirar(dados: DadosParaEnfileirar): Promise<{ jobId: string; status: string }> {
  const { job, criado } = await repositorioJobs.criarComDedupe({
    companyId: dados.companyId,
    tipo: dados.tipo,
    chaveDedupe: dados.chaveDedupe ?? null,
    payloadJson: dados.payload,
    maxTentativas: dados.maxTentativas,
  })

  if (!criado) {
    throw new ErroDaAplicacao(
      dados.mensagemConflito ?? 'Já existe uma operação em andamento para este item.',
      409
    )
  }

  acordarWorkerJobs()
  return { jobId: job.id, status: job.status }
}

async function statusJob(companyId: string, jobId: string): Promise<JobView> {
  const job = await repositorioJobs.buscarPorId(jobId, companyId)
  if (!job) throw new ErroDaAplicacao('Job não encontrado', 404)
  return {
    id: job.id,
    tipo: job.tipo,
    status: job.status,
    progresso: job.progresso,
    mensagem: job.mensagem,
    logResumo: job.logResumo,
    resultado: job.resultadoJson ?? null,
    iniciadoEm: job.iniciadoEm,
    finalizadoEm: job.finalizadoEm,
  }
}

async function existeJobAtivo(companyId: string, tipo: TipoJob): Promise<boolean> {
  return repositorioJobs.existeAtivo(companyId, tipo)
}

export const servicoJobs = {
  enfileirar,
  statusJob,
  existeJobAtivo,
}
