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

  it('peso ausente/zerado não cai para valor — retorna erro e não rateia parcial', () => {
    const r = ratearCustoFrete({
      regra: 'peso',
      itens: [
        { id: 'a', valorTotal: 50, quantidade: 1, pesoLinhaKg: 0 },
        { id: 'b', valorTotal: 50, quantidade: 1, pesoLinhaKg: 10 },
      ],
      valorTotalFrete: 20,
    })
    expect(r.regraAplicada).toBe('peso')
    expect(r.erros.length).toBeGreaterThan(0)
    expect(r.itens.every((i) => i.custoFreteRateado === 0)).toBe(true)
  })

  it('três itens: um sem peso bloqueia todos (não deixa uns com frete e outro 0)', () => {
    const r = ratearCustoFrete({
      regra: 'peso',
      itens: [
        { id: '1', valorTotal: 100, quantidade: 4, pesoLinhaKg: null },
        { id: '2', valorTotal: 200, quantidade: 11, pesoLinhaKg: 50 },
        { id: '3', valorTotal: 50, quantidade: 3, pesoLinhaKg: 10 },
      ],
      valorTotalFrete: 100,
    })
    expect(r.erros.length).toBeGreaterThan(0)
    expect(r.itens.find((i) => i.id === '1')?.custoFreteRateado).toBe(0)
    expect(r.itens.find((i) => i.id === '2')?.custoFreteRateado).toBe(0)
    expect(r.itens.find((i) => i.id === '3')?.custoFreteRateado).toBe(0)
  })

  it('três itens todos com peso: nenhum fica R$ 0,00', () => {
    const r = ratearCustoFrete({
      regra: 'peso',
      itens: [
        { id: '1', valorTotal: 476.32, quantidade: 4, pesoLinhaKg: 16 },
        { id: '2', valorTotal: 1169.63, quantidade: 11, pesoLinhaKg: 220 },
        { id: '3', valorTotal: 170.1, quantidade: 3, pesoLinhaKg: 9 },
      ],
      valorTotalFrete: 80,
    })
    expect(r.erros).toHaveLength(0)
    for (const item of r.itens) {
      expect(item.custoFreteRateado).toBeGreaterThan(0)
    }
    const soma = r.itens.reduce((a, i) => a + i.custoFreteRateado, 0)
    expect(soma).toBeCloseTo(80, 2)
  })

  it('valor do frete zerado retorna erro', () => {
    const r = ratearCustoFrete({ regra: 'peso', itens, valorTotalFrete: 0 })
    expect(r.erros.length).toBeGreaterThan(0)
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
