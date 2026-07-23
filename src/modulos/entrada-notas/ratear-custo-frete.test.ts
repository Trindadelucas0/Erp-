/**
 * Testes do rateio de frete CT-e → itens da NF.
 */
import { describe, expect, it } from 'vitest'
import { ratearCustoFrete } from './ratear-custo-frete.js'

describe('ratearCustoFrete', () => {
  const itens = [
    { id: 'a', valorTotal: 100, quantidade: 2, pesoKg: 10 },
    { id: 'b', valorTotal: 300, quantidade: 6, pesoKg: 30 },
  ]

  it('rateia por valor', () => {
    const r = ratearCustoFrete({ regra: 'valor', itens, valorTotalFrete: 40 })
    expect(r.regraAplicada).toBe('valor')
    expect(r.itens.find((i) => i.id === 'a')?.custoFreteRateado).toBe(10)
    expect(r.itens.find((i) => i.id === 'b')?.custoFreteRateado).toBe(30)
  })

  it('rateia por peso', () => {
    const r = ratearCustoFrete({ regra: 'peso', itens, valorTotalFrete: 40 })
    expect(r.itens.find((i) => i.id === 'a')?.custoFreteRateado).toBe(10)
    expect(r.itens.find((i) => i.id === 'b')?.custoFreteRateado).toBe(30)
  })

  it('peso zerado cai para valor', () => {
    const r = ratearCustoFrete({
      regra: 'peso',
      itens: [
        { id: 'a', valorTotal: 50, quantidade: 1, pesoKg: 0 },
        { id: 'b', valorTotal: 50, quantidade: 1, pesoKg: null },
      ],
      valorTotalFrete: 20,
    })
    expect(r.regraAplicada).toBe('valor')
    expect(r.avisos.length).toBeGreaterThan(0)
    expect(r.itens[0].custoFreteRateado).toBe(10)
    expect(r.itens[1].custoFreteRateado).toBe(10)
  })

  it('rateia por quantidade e igual', () => {
    const q = ratearCustoFrete({ regra: 'quantidade', itens, valorTotalFrete: 40 })
    expect(q.itens.find((i) => i.id === 'a')?.custoFreteRateado).toBe(10)
    expect(q.itens.find((i) => i.id === 'b')?.custoFreteRateado).toBe(30)

    const ig = ratearCustoFrete({ regra: 'igual', itens, valorTotalFrete: 40 })
    expect(ig.itens.find((i) => i.id === 'a')?.custoFreteRateado).toBe(20)
    expect(ig.itens.find((i) => i.id === 'b')?.custoFreteRateado).toBe(20)
  })
})
