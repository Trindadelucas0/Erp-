import { describe, expect, it } from 'vitest'
import {
  distribuirParcelasIguais,
  prazosValoresIguais,
  redistribuirParcelasManuaisProporcionalmente,
  sincronizarValoresParcelasComTotal,
} from './parcelas-pagamento-pedido'

const prazosComVencimento = [
  { numero: 1, vencimento: '2026-08-01', valor: '' },
  { numero: 2, vencimento: '2026-09-01', valor: '' },
  { numero: 3, vencimento: '2026-10-01', valor: '' },
]

describe('sincronizarValoresParcelasComTotal', () => {
  it('rateio igual divide total entre parcelas com vencimento', () => {
    const resultado = sincronizarValoresParcelasComTotal(prazosComVencimento, 'igual', 300)
    expect(resultado.map((p) => p.valor)).toEqual(['100', '100', '100'])
  })

  it('rateio igual recalcula quando total muda', () => {
    const resultado = sincronizarValoresParcelasComTotal(prazosComVencimento, 'igual', 600)
    expect(resultado.map((p) => p.valor)).toEqual(['200', '200', '200'])
  })

  it('rateio igual usa todas as linhas quando não há vencimento', () => {
    const prazos = [
      { numero: 1, vencimento: '', valor: '' },
      { numero: 2, vencimento: '', valor: '' },
    ]
    const resultado = sincronizarValoresParcelasComTotal(prazos, 'igual', 100)
    expect(resultado.map((p) => p.valor)).toEqual(['50', '50'])
  })
})

describe('redistribuirParcelasManuaisProporcionalmente', () => {
  it('mantém proporção ao mudar o total', () => {
    const prazos = [
      { numero: 1, vencimento: '2026-08-01', valor: '600' },
      { numero: 2, vencimento: '2026-09-01', valor: '400' },
    ]
    const resultado = redistribuirParcelasManuaisProporcionalmente(prazos, 1500)
    expect(resultado.map((p) => p.valor)).toEqual(['900', '600'])
  })

  it('faz fallback para igual quando soma atual é zero', () => {
    const prazos = [
      { numero: 1, vencimento: '2026-08-01', valor: '' },
      { numero: 2, vencimento: '2026-09-01', valor: '' },
    ]
    const resultado = redistribuirParcelasManuaisProporcionalmente(prazos, 100)
    expect(resultado.map((p) => p.valor)).toEqual(['50', '50'])
  })
})

describe('sincronizarValoresParcelasComTotal manual', () => {
  it('redistribui proporcionalmente no rateio manual', () => {
    const prazos = [
      { numero: 1, vencimento: '2026-08-01', valor: '700' },
      { numero: 2, vencimento: '2026-09-01', valor: '300' },
    ]
    const resultado = sincronizarValoresParcelasComTotal(prazos, 'manual', 2000)
    expect(resultado.map((p) => p.valor)).toEqual(['1400', '600'])
  })
})

describe('prazosValoresIguais', () => {
  it('detecta valores iguais', () => {
    const a = [{ numero: 1, vencimento: '', valor: '100' }]
    const b = [{ numero: 1, vencimento: '', valor: '100' }]
    expect(prazosValoresIguais(a, b)).toBe(true)
  })

  it('detecta valores diferentes', () => {
    const a = [{ numero: 1, vencimento: '', valor: '100' }]
    const b = [{ numero: 1, vencimento: '', valor: '200' }]
    expect(prazosValoresIguais(a, b)).toBe(false)
  })
})

describe('distribuirParcelasIguais', () => {
  it('absorve centavos na última parcela', () => {
    expect(distribuirParcelasIguais(3, 100)).toEqual([33.33, 33.33, 33.34])
  })
})
