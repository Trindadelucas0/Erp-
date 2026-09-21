import { describe, expect, it } from 'vitest'
import {
  ALIQUOTA_CREDITO_ICMS_BENEFICIO,
  calcularCustoContabilEntrada,
  creditoIcmsContabil,
} from './custo-comercial-entrada.js'

describe('creditoIcmsContabil', () => {
  it('usa vICMS do XML quando presente', () => {
    expect(creditoIcmsContabil(18, 1, 100)).toBe(18)
    expect(creditoIcmsContabil(0, 1, 100)).toBe(0)
  })

  it('sem vICMS aplica 12% da mercadoria', () => {
    expect(creditoIcmsContabil(null, 2, 50)).toBe(12)
    expect(creditoIcmsContabil(undefined, 1, 100)).toBe(
      (100 * ALIQUOTA_CREDITO_ICMS_BENEFICIO) / 100
    )
  })

  it('sem mercadoria válida e sem vICMS retorna 0', () => {
    expect(creditoIcmsContabil(null, null, 100)).toBe(0)
    expect(creditoIcmsContabil(null, 1, null)).toBe(0)
  })
})

describe('calcularCustoContabilEntrada', () => {
  it('sem frete, despesas e crédito iguala o unitário da NF', () => {
    expect(
      calcularCustoContabilEntrada({
        quantidadeNf: 2,
        valorUnitario: 10,
        custoFreteRateado: 0,
        valorIpi: 0,
        itensPorEmbalagem: 1,
        creditoIcms: 0,
      })
    ).toBe(10)
  })

  it('soma frete rateado antes de dividir pela qtd de estoque', () => {
    expect(
      calcularCustoContabilEntrada({
        quantidadeNf: 2,
        valorUnitario: 10,
        custoFreteRateado: 4,
        valorIpi: 0,
        itensPorEmbalagem: 1,
        creditoIcms: 0,
      })
    ).toBe(12)
  })

  it('soma seguro e outras despesas na linha', () => {
    expect(
      calcularCustoContabilEntrada({
        quantidadeNf: 1,
        valorUnitario: 100,
        valorSeguro: 3.5,
        valorOutrasDespesas: 1.5,
        itensPorEmbalagem: 1,
        creditoIcms: 0,
      })
    ).toBe(105)
  })

  it('abate créditos da NF da linha', () => {
    expect(
      calcularCustoContabilEntrada({
        quantidadeNf: 1,
        valorUnitario: 100,
        custoFreteRateado: 10,
        valorIpi: 0,
        itensPorEmbalagem: 1,
        creditoIcms: 18,
        creditoPis: 1.65,
        creditoCofins: 7.6,
      })
    ).toBeCloseTo(82.75)
  })

  it('XML sem PIS/COFINS não inventa crédito', () => {
    expect(
      calcularCustoContabilEntrada({
        quantidadeNf: 1,
        valorUnitario: 100,
        itensPorEmbalagem: 1,
        creditoIcms: 18,
        creditoPis: null,
        creditoCofins: undefined,
      })
    ).toBe(82)
  })

  it('crédito ICMS 12% quando vICMS ausente (benefício)', () => {
    const icms = creditoIcmsContabil(null, 1, 100)
    expect(icms).toBe(12)
    expect(
      calcularCustoContabilEntrada({
        quantidadeNf: 1,
        valorUnitario: 100,
        itensPorEmbalagem: 1,
        creditoIcms: icms,
        creditoPis: 1.65,
        creditoCofins: 7.6,
      })
    ).toBeCloseTo(78.75)
  })

  it('vICMS zero não cai no benefício de 12%', () => {
    const icms = creditoIcmsContabil(0, 1, 100)
    expect(icms).toBe(0)
    expect(
      calcularCustoContabilEntrada({
        quantidadeNf: 1,
        valorUnitario: 100,
        itensPorEmbalagem: 1,
        creditoIcms: icms,
      })
    ).toBe(100)
  })

  it('crédito maior que o custo deixa custo contábil <= 0', () => {
    const custo = calcularCustoContabilEntrada({
      quantidadeNf: 1,
      valorUnitario: 10,
      itensPorEmbalagem: 1,
      creditoIcms: 20,
    })
    expect(custo).toBe(-10)
  })
})
