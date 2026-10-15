import { describe, expect, it } from 'vitest'
import { ratearCreditoIcmsFrete } from './credito-icms-frete.js'
import { calcularCustoContabilEntrada } from './custo-comercial-entrada.js'

const itens = [{ id: 'a', custoFreteRateado: 60 }, { id: 'b', custoFreteRateado: 40 }]
describe('crédito ICMS do transporte', () => {
  it('aplica alíquota fixa sobre o frete dos CT-es e distribui 60/40', () => {
    const mapa = ratearCreditoIcmsFrete('1', itens, [{ valorFrete: 100, valorIcms: 18 }], { modo: 'pre_definida', aliquota: 12 })
    expect([...mapa.values()]).toEqual([7.2, 4.8])
    expect(calcularCustoContabilEntrada({ quantidadeNf: 1, valorUnitario: 100, custoFreteRateado: 60, itensPorEmbalagem: 1, creditoIcmsFrete: mapa.get('a') })).toBe(152.8)
  })
  it('soma múltiplos CT-es, preservando zero e ausência do XML', () => {
    const mapa = ratearCreditoIcmsFrete('1', itens, [
      { valorFrete: 70, valorIcms: 8 }, { valorFrete: 30, valorIcms: 4 },
      { valorFrete: 10, valorIcms: null }, { valorFrete: 10, valorIcms: 0 },
    ], { modo: 'nota', aliquota: null })
    expect([...mapa.values()]).toEqual([7.2, 4.8])
  })
  it.each(['0', '2', '9', null])('não dá crédito quando modFrete=%s', (modo) => {
    expect([...ratearCreditoIcmsFrete(modo, itens, [{ valorFrete: 100, valorIcms: 12 }], { modo: 'nota', aliquota: null }).values()]).toEqual([0, 0])
  })
  it('rateio zero, CT-e ausente ou XML sem ICMS dá zero', () => {
    const regra = { modo: 'nota' as const, aliquota: null }
    expect([...ratearCreditoIcmsFrete('1', [{ id: 'a', custoFreteRateado: 0 }], [{ valorFrete: 100, valorIcms: 12 }], regra).values()]).toEqual([0])
    expect([...ratearCreditoIcmsFrete('1', itens, [], regra).values()]).toEqual([0, 0])
    expect([...ratearCreditoIcmsFrete('1', itens, [{ valorFrete: 100, valorIcms: null }], regra).values()]).toEqual([0, 0])
  })
  it('preserva o total em centavos em proporções não exatas', () => {
    const mapa = ratearCreditoIcmsFrete('1', ['a', 'b', 'c'].map((id) => ({ id, custoFreteRateado: 1 })), [{ valorFrete: 3, valorIcms: 0.01 }], { modo: 'nota', aliquota: null })
    expect([...mapa.values()]).toEqual([0.01, 0, 0])
  })
})
