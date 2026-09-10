/**
 * Contrato da fila de jobs (tabela `Job`) consumida pelo worker.
 */

/** Tipos registrados hoje. Novos tipos entram aqui e em `registro-handlers-job.ts`. */
export type TipoJob = 'focus_sync' | 'ia_conferencia'

export type StatusJob = 'pendente' | 'rodando' | 'ok' | 'erro'

export const STATUS_JOB_ATIVO: readonly StatusJob[] = ['pendente', 'rodando']

/** Job `pendente` sem o worker pegar — BUSCAR não deve pollar para sempre. */
export const JOB_PENDENTE_TRAVADO_MS = 45_000
/** Job `rodando` além disto (mesmo com heartbeat) é considerado travado. */
export const JOB_RODANDO_TRAVADO_MS = 8 * 60_000
/** Corta o handler no worker para o GET /jobs/:id chegar em `erro`. */
export const JOB_HANDLER_TIMEOUT_MS = 8 * 60_000

export function jobAtivoEstaTravado(
  job: { status: string; createdAt: Date; iniciadoEm: Date | null },
  agora = Date.now()
): boolean {
  if (job.status === 'pendente') {
    return agora - job.createdAt.getTime() > JOB_PENDENTE_TRAVADO_MS
  }
  if (job.status === 'rodando') {
    const inicio = (job.iniciadoEm ?? job.createdAt).getTime()
    return agora - inicio > JOB_RODANDO_TRAVADO_MS
  }
  return false
}

export type ContextoJob = {
  jobId: string
  companyId: string
  payload: Record<string, unknown>
  /** Atualiza progresso/mensagem para o poll da tela. */
  progresso(valor: number, mensagem?: string): Promise<void>
  /** Linha de log acumulada em `logResumo` (últimas 40). */
  log(mensagem: string): void
}

export type ResultadoJob = {
  /** Mensagem final exibida na tela. */
  mensagem?: string
  /** Payload devolvido no GET /jobs/:id (ex.: relatório da conferência). */
  resultado?: unknown
}

export type HandlerJob = (contexto: ContextoJob) => Promise<ResultadoJob | void>

export type JobView = {
  id: string
  tipo: string
  status: string
  progresso: number
  mensagem: string | null
  logResumo: string | null
  resultado: unknown
  iniciadoEm: Date | null
  finalizadoEm: Date | null
}
