/**
 * Tipos compartilhados do pipeline de Entrada de Notas.
 */
import type { AuditoriaChegadaJson } from './auditoria-chegada/avaliar-auditoria-chegada.js'

export type StatusEtapaAnalise = 'ok' | 'aviso' | 'bloqueante' | 'pendente'

export type ResultadoEtapa = {
  status: StatusEtapaAnalise
  avisos: string[]
  /** Bloqueios que o gerente pode liberar (NCM/origem, negociação). */
  bloqueios: string[]
  /**
   * Bloqueios que exigem manifesto/devolução (CST/CFOP) — nunca liberáveis por senha.
   * Presente sobretudo em `analise.fiscal`.
   */
  bloqueiosNaoLiberaveis?: string[]
  /** true quando há CST/CFOP impeditivo — só desconhecimento/devolução. */
  exigeManifesto?: boolean
  detalhes?: Record<string, unknown>
}

export type AnaliseJson = {
  versao: number
  atualizadoEm: string
  cadastro: ResultadoEtapa
  fiscal: ResultadoEtapa
  negociacao: ResultadoEtapa
  /** Gate frete/CT-e (NFe 55 com modFrete destinatário). */
  frete?: ResultadoEtapa
  autoLancado?: boolean
  motivoParada?: string | null
  /** Conferência de preço/nome em Aguardando chegada (§7.19). */
  chegada?: AuditoriaChegadaJson
  divergenciaGestao?: {
    bloqueioExplicacao?: string
    bloqueioEm?: string
    desbloqueioExplicacao?: string
    desbloqueioEm?: string
  }
}

export function etapaVazia(status: StatusEtapaAnalise = 'pendente'): ResultadoEtapa {
  return { status, avisos: [], bloqueios: [] }
}
