import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

export type DadosComVinculosPlanos = {
  planosFinanceirosIds?: string[]
  planoFinanceiroAlternativoId?: string | null
  paresPlanoCfopPadrao?: { planoFinanceiroId: string; cfopId: string }[]
}

/** Coleta IDs únicos de planos vinculados ao fornecedor. */
export function coletarIdsPlanosFinanceiros(dados: DadosComVinculosPlanos): string[] {
  const planoIds = [
    ...(dados.planosFinanceirosIds ?? []),
    ...(dados.planoFinanceiroAlternativoId ? [dados.planoFinanceiroAlternativoId] : []),
    ...(dados.paresPlanoCfopPadrao ?? []).map((p) => p.planoFinanceiroId),
  ]
  return [...new Set(planoIds)]
}

/** Garante que todos os IDs enviados correspondem a planos despesa ativos retornados pela consulta. */
export function assertTodosPlanosDespesaEncontrados(
  idsEsperados: string[],
  planosEncontrados: { id: string }[]
): void {
  if (idsEsperados.length > 0 && planosEncontrados.length !== idsEsperados.length) {
    throw new ErroDaAplicacao('Plano financeiro deve ser do tipo Despesas', 400)
  }
}
