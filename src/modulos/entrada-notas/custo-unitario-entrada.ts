/**
 * Custo por unidade de venda na Auditoria de entradas.
 * Fonte: DOCUMENTACAO-SISTEMA.md §6.17g.
 *
 * qtdEstoque = qtd NF × itensPorEmbalagem
 * custoLinha = (valorUnitário × qtd NF) + frete rateado + IPI (vIPI)
 * custoEntrada = custoLinha / qtdEstoque
 *
 * Os percentuais de Configurações → Vendas **não** entram nesta fórmula.
 */

export const LIMIAR_DESTAQUE_VARIACAO_CUSTO = 0.3

export type UltimoCustoConsolidado = {
  produtoId: string
  /** Preço unitário da NF ÷ embalagem — usado só na conferência de Aguardando chegada. */
  precoUnitarioVenda: number
  /** Mesma fórmula de custo da Auditoria (frete + IPI + embalagem). */
  custoEntrada: number | null
}

export type EntradaCustoUnitario = {
  quantidadeNf: number | null | undefined
  valorUnitario: number | null | undefined
  custoFreteRateado?: number | null | undefined
  valorIpi?: number | null | undefined
  itensPorEmbalagem: number
}

export function resolverValorIpi(
  gravado: number | null | undefined,
  fallbackXml: number | null | undefined
): number {
  if (gravado != null && Number.isFinite(gravado)) return gravado
  if (fallbackXml != null && Number.isFinite(fallbackXml)) return fallbackXml
  return 0
}

export function calcularCustoUnitarioEntrada(params: EntradaCustoUnitario): number | null {
  const qtdNf = params.quantidadeNf
  const unitario = params.valorUnitario
  if (qtdNf == null || !Number.isFinite(qtdNf) || qtdNf <= 0) return null
  if (unitario == null || !Number.isFinite(unitario)) return null

  const mult = params.itensPorEmbalagem > 0 ? params.itensPorEmbalagem : 1
  const qtdEstoque = qtdNf * mult
  if (!Number.isFinite(qtdEstoque) || qtdEstoque <= 0) return null

  const frete =
    params.custoFreteRateado != null && Number.isFinite(params.custoFreteRateado)
      ? params.custoFreteRateado
      : 0
  const ipi =
    params.valorIpi != null && Number.isFinite(params.valorIpi) ? params.valorIpi : 0
  const custoLinha = unitario * qtdNf + frete + ipi
  return custoLinha / qtdEstoque
}

/** (custoEntrada − custoAnterior) / custoAnterior. Sem histórico ou denominador 0 → null. */
export function calcularVariacaoCusto(
  custoEntrada: number | null,
  custoAnterior: number | null
): number | null {
  if (custoEntrada == null || !Number.isFinite(custoEntrada)) return null
  if (custoAnterior == null || !Number.isFinite(custoAnterior) || custoAnterior === 0) {
    return null
  }
  return (custoEntrada - custoAnterior) / custoAnterior
}

export function montarCustoComparativo(params: {
  quantidadeNf: number | null | undefined
  valorUnitario: number | null | undefined
  custoFreteRateado?: number | null | undefined
  valorIpi?: number | null | undefined
  itensPorEmbalagem: number
  produtoId: string | null | undefined
  ultimaPorProduto: Map<string, UltimoCustoConsolidado>
}): {
  custoEntrada: number | null
  custoAnterior: number | null
  variacaoPercentual: number | null
} {
  const custoEntrada = calcularCustoUnitarioEntrada(params)
  const produtoId = params.produtoId
  const ultimaPorProduto = params.ultimaPorProduto ?? new Map()
  if (!produtoId) {
    return { custoEntrada, custoAnterior: null, variacaoPercentual: null }
  }
  const anterior = ultimaPorProduto.get(produtoId)
  const custoAnterior = anterior?.custoEntrada ?? null
  return {
    custoEntrada,
    custoAnterior,
    variacaoPercentual: calcularVariacaoCusto(custoEntrada, custoAnterior),
  }
}
