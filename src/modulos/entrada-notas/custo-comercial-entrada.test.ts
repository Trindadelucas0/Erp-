import { describe, expect, it } from 'vitest'
import {
  calcularCustoComercialEntrada,
  creditoIcmsComercial,
} from './custo-comercial-entrada.js'

describe('creditoIcmsComercial', () => {
  it('zera ICMS quando o CFOP não aproveita crédito', () => {
    expect(creditoIcmsComercial(18, false)).toBe(0)
  })

  it('usa vICMS do XML quando o CFOP aproveita', () => {
    expect(creditoIcmsComercial(18, true)).toBe(18)
    expect(creditoIcmsComercial(null, true)).toBe(0)
  })
})

describe('calcularCustoComercialEntrada', () => {
  it('sem frete e sem crédito iguala o unitário da NF', () => {
    expect(
      calcularCustoComercialEntrada({
        quantidadeNf: 2,
        valorUnitario: 10,
        custoFreteRateado: 0,
        valorIpi: 0,
        itensPorEmbalagem: 1,
      })
    ).toBe(10)
  })

  it('soma frete rateado antes de dividir pela qtd de estoque', () => {
    expect(
      calcularCustoComercialEntrada({
        quantidadeNf: 2,
        valorUnitario: 10,
        custoFreteRateado: 4,
        valorIpi: 0,
        itensPorEmbalagem: 1,
      })
    ).toBe(12)
  })

  it('abate créditos da NF da linha', () => {
    expect(
      calcularCustoComercialEntrada({
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
      calcularCustoComercialEntrada({
        quantidadeNf: 1,
        valorUnitario: 100,
        itensPorEmbalagem: 1,
        creditoIcms: 18,
        creditoPis: null,
        creditoCofins: undefined,
      })
    ).toBe(82)
  })

  it('CFOP sem flag deixa ICMS zerado e PIS/COFINS do XML continuam', () => {
    const icms = creditoIcmsComercial(18, false)
    expect(
      calcularCustoComercialEntrada({
        quantidadeNf: 1,
        valorUnitario: 100,
        itensPorEmbalagem: 1,
        creditoIcms: icms,
        creditoPis: 1.65,
        creditoCofins: 7.6,
      })
    ).toBeCloseTo(90.75)
  })

  it('crédito maior que o custo deixa custo comercial <= 0', () => {
    const custo = calcularCustoComercialEntrada({
      quantidadeNf: 1,
      valorUnitario: 10,
      itensPorEmbalagem: 1,
      creditoIcms: 20,
    })
    expect(custo).toBe(-10)
  })
})
