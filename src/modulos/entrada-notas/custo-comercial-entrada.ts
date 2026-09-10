/**
 * Custo comercial por unidade de venda (grade Precificação).
 * Fonte: DOCUMENTACAO-SISTEMA.md §7.26.
 *
 * qtdEstoque = qtd NF × itensPorEmbalagem
 * custoLinha = mercadoria + frete rateado + IPI − crédito ICMS − crédito PIS − crédito COFINS
 * custoComercial = custoLinha / qtdEstoque
 *
 * Crédito ICMS só se o CFOP de entrada tiver aproveitarCreditoIcms.
 * PIS/COFINS vêm do XML (vPIS/vCOFINS); sem tag → 0; não inventa p% × base.
 * Não altera calcularCustoUnitarioEntrada (Auditoria / kardex).
 */

export type EntradaCustoComercial = {
  quantidadeNf: number | null | undefined
  valorUnitario: number | null | undefined
  custoFreteRateado?: number | null | undefined
  valorIpi?: number | null | undefined
  itensPorEmbalagem: number
  creditoIcms?: number | null | undefined
  creditoPis?: number | null | undefined
  creditoCofins?: number | null | undefined
}

function creditoOuZero(n: number | null | undefined): number {
  return n != null && Number.isFinite(n) ? n : 0
}

export function creditoIcmsComercial(
  valorIcmsXml: number | null | undefined,
  aproveitarCreditoIcms: boolean
): number {
  if (!aproveitarCreditoIcms) return 0
  return creditoOuZero(valorIcmsXml)
}

export function calcularCustoComercialEntrada(params: EntradaCustoComercial): number | null {
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
  const ipi = params.valorIpi != null && Number.isFinite(params.valorIpi) ? params.valorIpi : 0
  const custoLinha =
    unitario * qtdNf +
    frete +
    ipi -
    creditoOuZero(params.creditoIcms) -
    creditoOuZero(params.creditoPis) -
    creditoOuZero(params.creditoCofins)
  return custoLinha / qtdEstoque
}
