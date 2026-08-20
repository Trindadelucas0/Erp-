/**
 * Contrato da fila de jobs (tabela `Job`) consumida pelo worker.
 */

/** Tipos registrados hoje. Novos tipos entram aqui e em `registro-handlers-job.ts`. */
export type TipoJob = 'focus_sync' | 'ia_conferencia'

export type StatusJob = 'pendente' | 'rodando' | 'ok' | 'erro'

export const STATUS_JOB_ATIVO: readonly StatusJob[] = ['pendente', 'rodando']

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
