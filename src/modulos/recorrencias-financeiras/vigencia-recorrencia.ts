/**
 * Vigência da recorrência financeira (competência YYYY-MM).
 * Fonte: DOCUMENTACAO-SISTEMA.md §7.23.
 */

export type PeriodicidadeRecorrencia = 'mensal' | 'anual'

export type RecorrenciaComVigencia = {
  id: string
  periodicidade: string
  competenciaInicio: string
  competenciaFim: string | null
}

const TZ_BRASIL = 'America/Sao_Paulo'
const REGEX_COMPETENCIA = /^(\d{4})-(0[1-9]|1[0-2])$/

export function competenciaEhValida(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && REGEX_COMPETENCIA.test(valor)
}

export function competenciaDeData(data: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BRASIL,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(data)
  const ano = partes.find((p) => p.type === 'year')?.value ?? '0000'
  const mes = partes.find((p) => p.type === 'month')?.value ?? '01'
  return `${ano}-${mes}`
}

export function mesDaCompetencia(competencia: string): string {
  return competencia.slice(5, 7)
}

/**
 * A regra vale nesta competência se:
 * - competência está entre início e fim (fim nulo = aberto);
 * - anual: só no mês de aniversário (mês de competenciaInicio).
 */
export function competenciaEstaNaVigencia(input: {
  competencia: string
  periodicidade: string
  competenciaInicio: string
  competenciaFim: string | null
}): boolean {
  if (!competenciaEhValida(input.competencia)) return false
  if (!competenciaEhValida(input.competenciaInicio)) return false
  if (input.competencia < input.competenciaInicio) return false
  if (input.competenciaFim && competenciaEhValida(input.competenciaFim)) {
    if (input.competencia > input.competenciaFim) return false
  }
  if (input.periodicidade === 'anual') {
    return mesDaCompetencia(input.competencia) === mesDaCompetencia(input.competenciaInicio)
  }
  return true
}

/** Sem data de emissão a regra não se aplica (fluxo normal). */
export function filtrarRecorrenciasNaVigencia<T extends RecorrenciaComVigencia>(
  recorrencias: T[],
  dataEmissao: Date | null | undefined
): T[] {
  if (!dataEmissao) return []
  const competencia = competenciaDeData(dataEmissao)
  return recorrencias.filter((r) =>
    competenciaEstaNaVigencia({
      competencia,
      periodicidade: r.periodicidade,
      competenciaInicio: r.competenciaInicio,
      competenciaFim: r.competenciaFim,
    })
  )
}

/** Regras habilitadas que devem aparecer na agenda da competência. */
export function filtrarRecorrenciasDaAgenda<T extends RecorrenciaComVigencia>(
  recorrencias: T[],
  competencia: string
): T[] {
  return recorrencias.filter((r) =>
    competenciaEstaNaVigencia({
      competencia,
      periodicidade: r.periodicidade,
      competenciaInicio: r.competenciaInicio,
      competenciaFim: r.competenciaFim,
    })
  )
}

/** Janela UTC folgada (±36h) para buscar NFe por competência no fuso de Brasília. */
export function intervaloBuscaDaCompetencia(competencia: string): { gte: Date; lt: Date } {
  const [ano, mes] = competencia.split('-').map(Number)
  const inicioUtc = Date.UTC(ano, mes - 1, 1)
  const fimUtc = Date.UTC(ano, mes, 1)
  return {
    gte: new Date(inicioUtc - 36 * 3600 * 1000),
    lt: new Date(fimUtc + 36 * 3600 * 1000),
  }
}
