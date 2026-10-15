/**
 * Custo contábil por unidade de venda (grade Precificação).
 * Fórmula da Precificação (DOCUMENTACAO-SISTEMA.md §7.26).
 *
 * qtdEstoque = qtd NF × itensPorEmbalagem
 * custoLinha = mercadoria + frete rateado + IPI + seguro + outras despesas
 *              − crédito ICMS − crédito PIS − crédito COFINS
 * custoContabil = custoLinha / qtdEstoque
 *
 * Crédito ICMS: regra fiscal vigente da empresa; XML ausente resulta em zero.
 * Crédito do transporte é informado já rateado. Flag do CFOP não zera o crédito.
 * PIS/COFINS vêm do XML (vPIS/vCOFINS); sem tag → 0; não inventa p% × base.
 * Não altera calcularCustoUnitarioEntrada (Auditoria / kardex).
 */

import type { RegraCredito } from '../configuracoes/esquema-regras-fiscais.js'

export type EntradaCustoContabil = {
  quantidadeNf: number | null | undefined
  valorUnitario: number | null | undefined
  custoFreteRateado?: number | null | undefined
  valorIpi?: number | null | undefined
  valorSeguro?: number | null | undefined
  valorOutrasDespesas?: number | null | undefined
  itensPorEmbalagem: number
  creditoIcms?: number | null | undefined
  creditoIcmsFrete?: number | null | undefined
  creditoPis?: number | null | undefined
  creditoCofins?: number | null | undefined
}

/** @deprecated Use EntradaCustoContabil. Mantido para imports legados. */
export type EntradaCustoComercial = EntradaCustoContabil

function creditoOuZero(n: number | null | undefined): number {
  return n != null && Number.isFinite(n) ? n : 0
}

function mercadoriaLinha(
  quantidadeNf: number,
  valorUnitario: number
): number {
  return valorUnitario * quantidadeNf
}

/**
 * Crédito ICMS da precificação: usa vICMS quando presente (inclusive 0);
 * sem tag / null → zero. No modo pré-definido, usa a base da mercadoria.
 */
export function creditoIcmsContabil(
  valorIcmsXml: number | null | undefined,
  quantidadeNf: number | null | undefined,
  valorUnitario: number | null | undefined,
  regra: RegraCredito = { modo: 'nota', aliquota: null }
): number {
  if (regra.modo === 'nota') return creditoOuZero(valorIcmsXml)
  if (
    quantidadeNf == null ||
    !Number.isFinite(quantidadeNf) ||
    quantidadeNf <= 0 ||
    valorUnitario == null ||
    !Number.isFinite(valorUnitario)
  ) {
    return 0
  }
  return (mercadoriaLinha(quantidadeNf, valorUnitario) * creditoOuZero(regra.aliquota)) / 100
}

/** @deprecated Use creditoIcmsContabil. Mantido para imports legados. */
export function creditoIcmsComercial(
  valorIcmsXml: number | null | undefined,
  _aproveitarCreditoIcms: boolean
): number {
  return creditoOuZero(valorIcmsXml)
}

/** Custo contábil com créditos e despesas originais da nota. */
export function calcularCustoContabilEntrada(params: EntradaCustoContabil): number | null {
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
  const seguro =
    params.valorSeguro != null && Number.isFinite(params.valorSeguro) ? params.valorSeguro : 0
  const outras =
    params.valorOutrasDespesas != null && Number.isFinite(params.valorOutrasDespesas)
      ? params.valorOutrasDespesas
      : 0
  const custoLinha =
    mercadoriaLinha(qtdNf, unitario) +
    frete +
    ipi +
    seguro +
    outras -
    creditoOuZero(params.creditoIcms) -
    creditoOuZero(params.creditoIcmsFrete) -
    creditoOuZero(params.creditoPis) -
    creditoOuZero(params.creditoCofins)
  return custoLinha / qtdEstoque
}

/** @deprecated Use calcularCustoContabilEntrada. */
export function calcularCustoComercialEntrada(params: EntradaCustoContabil): number | null {
  return calcularCustoContabilEntrada(params)
}
