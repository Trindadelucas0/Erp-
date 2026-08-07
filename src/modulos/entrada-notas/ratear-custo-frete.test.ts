/**
 * Testes do rateio de frete CT-e → itens da NF.
 */
import { describe, expect, it } from 'vitest'
import { ratearCustoFrete } from './ratear-custo-frete.js'

describe('ratearCustoFrete', () => {
  const itens = [
    { id: 'a', valorTotal: 100, quantidade: 2, pesoLinhaKg: 10 },
    { id: 'b', valorTotal: 300, quantidade: 6, pesoLinhaKg: 30 },
  ]

  it('rateia por valor', () => {
    const r = ratearCustoFrete({ regra: 'valor', itens, valorTotalFrete: 40 })
    expect(r.regraAplicada).toBe('valor')
    expect(r.erros).toHaveLength(0)
    expect(r.itens.find((i) => i.id === 'a')?.custoFreteRateado).toBe(10)
    expect(r.itens.find((i) => i.id === 'b')?.custoFreteRateado).toBe(30)
  })

  it('rateia por peso (pesoLinhaKg = peso unit × qtd entrada)', () => {
    // Ex.: 720 kg total, R$ 1000 → taxa ≈ 1,3889; item 120 kg → 166,67
    const r = ratearCustoFrete({
      regra: 'peso',
      itens: [
        { id: 'a', valorTotal: 100, quantidade: 100, pesoLinhaKg: 120 },
        { id: 'b', valorTotal: 300, quantidade: 200, pesoLinhaKg: 600 },
      ],
      valorTotalFrete: 1000,
    })
    expect(r.regraAplicada).toBe('peso')
    expect(r.erros).toHaveLength(0)
    expect(r.itens.find((i) => i.id === 'a')?.custoFreteRateado).toBe(166.67)
    expect(r.itens.find((i) => i.id === 'b')?.custoFreteRateado).toBe(833.33)
  })

  it('rateia por peso proporcional simples', () => {
    const r = ratearCustoFrete({ regra: 'peso', itens, valorTotalFrete: 40 })
    expect(r.itens.find((i) => i.id === 'a')?.custoFreteRateado).toBe(10)
    expect(r.itens.find((i) => i.id === 'b')?.custoFreteRateado).toBe(30)
  })

  it('peso ausente/zerado não cai para valor — retorna erro', () => {
    const r = ratearCustoFrete({
      regra: 'peso',
      itens: [
        { id: 'a', valorTotal: 50, quantidade: 1, pesoLinhaKg: 0 },
        { id: 'b', valorTotal: 50, quantidade: 1, pesoLinhaKg: null },
      ],
      valorTotalFrete: 20,
    })
    expect(r.regraAplicada).toBe('peso')
    expect(r.erros.length).toBeGreaterThan(0)
    expect(r.itens[0].custoFreteRateado).toBe(0)
    expect(r.itens[1].custoFreteRateado).toBe(0)
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
