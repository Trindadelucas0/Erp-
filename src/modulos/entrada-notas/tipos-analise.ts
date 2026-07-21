/**
 * Tipos compartilhados do pipeline de Entrada de Notas.
 */

export type StatusEtapaAnalise = 'ok' | 'aviso' | 'bloqueante' | 'pendente'

export type ResultadoEtapa = {
  status: StatusEtapaAnalise
  avisos: string[]
  bloqueios: string[]
  detalhes?: Record<string, unknown>
}

export type AnaliseJson = {
  versao: number
  atualizadoEm: string
  cadastro: ResultadoEtapa
  fiscal: ResultadoEtapa
  negociacao: ResultadoEtapa
  autoLancado?: boolean
  motivoParada?: string | null
}

export function etapaVazia(status: StatusEtapaAnalise = 'pendente'): ResultadoEtapa {
  return { status, avisos: [], bloqueios: [] }
}
