/**
 * Worker de jobs: consome a tabela `Job` fora do request HTTP.
 *
 * Roda no processo da API (ligado em `aplicacao.ts`); como o claim é feito no
 * banco com SKIP LOCKED, mover para um processo separado depois não exige
 * mudar handler nenhum. Desligar: `JOBS_WORKER=false`.
 */
import { hostname } from 'node:os'
import { ErroDaAplicacao } from '../erros/ErroDaAplicacao.js'
import { obterHandlerJob } from './registro-handlers-job.js'
import { repositorioJobs } from './repositorio-jobs.js'
import type { ContextoJob, ResultadoJob } from './tipos-job.js'

const INTERVALO_POLL_MS = 1_000
const INTERVALO_HEARTBEAT_MS = 45_000
const INTERVALO_VARREDURA_ORFAOS_MS = 60_000
const MAX_LINHAS_LOG = 40

const identificacao = `${hostname()}#${process.pid}`

let ativo = false
let timerPoll: ReturnType<typeof setInterval> | null = null
let timerOrfaos: ReturnType<typeof setInterval> | null = null
let emExecucao = 0
let buscandoJob = false

function concorrencia(): number {
  const bruto = Number(process.env.JOBS_CONCORRENCIA)
  if (!Number.isFinite(bruto) || bruto < 1) return 2
  return Math.min(8, Math.trunc(bruto))
}

export function logJob(
  nivel: 'info' | 'warn' | 'error',
  evento: string,
  dados: Record<string, unknown> = {}
) {
  const partes = Object.entries(dados)
    .filter(([, valor]) => valor !== undefined && valor !== null)
    .map(([chave, valor]) => `${chave}=${valor}`)
  const linha = `[jobs] ${evento}${partes.length ? ` ${partes.join(' ')}` : ''}`
  if (nivel === 'error') console.error(linha)
  else if (nivel === 'warn') console.warn(linha)
  else console.log(linha)
}

async function executarJob(job: {
  id: string
  companyId: string
  tipo: string
  payloadJson: unknown
}) {
  const handler = obterHandlerJob(job.tipo)
  if (!handler) {
    await repositorioJobs.registrarFalha(job.id, {
      mensagem: `Tipo de job não registrado: ${job.tipo}.`,
    })
    logJob('error', 'tipo_nao_registrado', { id: job.id, tipo: job.tipo })
    return
  }

  const linhasLog: string[] = []
  const contexto: ContextoJob = {
    jobId: job.id,
    companyId: job.companyId,
    payload: (job.payloadJson ?? {}) as Record<string, unknown>,
    async progresso(valor, mensagem) {
      await repositorioJobs.atualizarProgresso(
        job.id,
        valor,
        mensagem,
        linhasLog.length ? linhasLog.join('\n') : null
      )
    },
    log(mensagem) {
      linhasLog.push(mensagem)
      if (linhasLog.length > MAX_LINHAS_LOG) linhasLog.shift()
    },
  }

  const heartbeat = setInterval(() => {
    void repositorioJobs.baterHeartbeat(job.id).catch(() => undefined)
  }, INTERVALO_HEARTBEAT_MS)

  logJob('info', 'job_inicio', { id: job.id, tipo: job.tipo, companyId: job.companyId })

  try {
    const retorno = ((await handler(contexto)) ?? {}) as ResultadoJob
    await repositorioJobs.finalizarComSucesso(job.id, {
      mensagem: retorno.mensagem ?? null,
      resultado: retorno.resultado,
      logResumo: linhasLog.length ? linhasLog.join('\n') : null,
    })
    logJob('info', 'job_fim', { id: job.id, tipo: job.tipo, status: 'ok' })
  } catch (erro) {
    const mensagem =
      erro instanceof ErroDaAplicacao || erro instanceof Error
        ? erro.message
        : 'Falha inesperada no job.'
    linhasLog.push(`erro: ${mensagem}`)
    const status = await repositorioJobs.registrarFalha(job.id, {
      mensagem,
      logResumo: linhasLog.join('\n'),
    })
    logJob('error', 'job_fim', { id: job.id, tipo: job.tipo, status, mensagem })
  } finally {
    clearInterval(heartbeat)
  }
}

async function processarFila() {
  if (!ativo || buscandoJob) return
  buscandoJob = true
  try {
    while (ativo && emExecucao < concorrencia()) {
      const job = await repositorioJobs.reivindicarProximo(identificacao)
      if (!job) return

      emExecucao += 1
      void executarJob(job)
        .catch((erro) => {
          logJob('error', 'job_erro_nao_tratado', {
            id: job.id,
            mensagem: erro instanceof Error ? erro.message : String(erro),
          })
        })
        .finally(() => {
          emExecucao -= 1
          void processarFila()
        })
    }
  } catch (erro) {
    logJob('error', 'claim_falhou', {
      mensagem: erro instanceof Error ? erro.message : String(erro),
    })
  } finally {
    buscandoJob = false
  }
}

/** Chamado ao enfileirar para não esperar o próximo poll. */
export function acordarWorkerJobs(): void {
  if (!ativo) return
  setImmediate(() => {
    void processarFila()
  })
}

async function varrerOrfaos() {
  try {
    const recuperados = await repositorioJobs.recuperarOrfaos()
    if (recuperados > 0) {
      logJob('warn', 'jobs_recuperados', { quantidade: recuperados })
      acordarWorkerJobs()
    }
  } catch (erro) {
    logJob('error', 'varredura_orfaos_falhou', {
      mensagem: erro instanceof Error ? erro.message : String(erro),
    })
  }
}

export function workerJobsAtivoPorEnv(): boolean {
  const bruto = (process.env.JOBS_WORKER ?? 'true').trim().toLowerCase()
  return !['false', '0', 'nao', 'não', 'off'].includes(bruto)
}

export function iniciarWorkerJobs(): void {
  if (ativo) return
  ativo = true
  logJob('info', 'worker_inicio', { por: identificacao, concorrencia: concorrencia() })

  void varrerOrfaos()
  timerOrfaos = setInterval(() => {
    void varrerOrfaos()
  }, INTERVALO_VARREDURA_ORFAOS_MS)

  timerPoll = setInterval(() => {
    void processarFila()
  }, INTERVALO_POLL_MS)

  acordarWorkerJobs()
}

export function pararWorkerJobs(): void {
  ativo = false
  if (timerPoll) {
    clearInterval(timerPoll)
    timerPoll = null
  }
  if (timerOrfaos) {
    clearInterval(timerOrfaos)
    timerOrfaos = null
  }
}
