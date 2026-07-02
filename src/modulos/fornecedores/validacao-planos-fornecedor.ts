import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

export const MSG_PLANO_SUBGRUPO_DESPESA =
  'Plano financeiro deve ser subgrupo de Despesas (ex.: 2.1.1)'

export type DadosComVinculosPlanos = {
  planosFinanceirosIds?: string[]
  paresPlanoCfopPadrao?: { planoFinanceiroId: string; cfopId: string }[]
}

/** Coleta IDs únicos de planos vinculados ao fornecedor. */
export function coletarIdsPlanosFinanceiros(dados: DadosComVinculosPlanos): string[] {
  const planoIds = [
    ...(dados.planosFinanceirosIds ?? []),
    ...(dados.paresPlanoCfopPadrao ?? []).map((p) => p.planoFinanceiroId),
  ]
  return [...new Set(planoIds)]
}

/** Garante que todos os IDs enviados correspondem a subgrupos despesa ativos retornados pela consulta. */
export function assertTodosPlanosSubgrupoDespesaEncontrados(
  idsEsperados: string[],
  planosEncontrados: { id: string }[]
): void {
  if (idsEsperados.length > 0 && planosEncontrados.length !== idsEsperados.length) {
    throw new ErroDaAplicacao(MSG_PLANO_SUBGRUPO_DESPESA, 400)
  }
}
