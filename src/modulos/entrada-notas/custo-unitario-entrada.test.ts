import { describe, expect, it } from 'vitest'
import {
  calcularCustoUnitarioEntrada,
  calcularVariacaoCusto,
  LIMIAR_DESTAQUE_VARIACAO_CUSTO,
  montarCustoComparativo,
  type UltimoCustoConsolidado,
} from './custo-unitario-entrada.js'

describe('calcularCustoUnitarioEntrada', () => {
  it('sem frete e sem IPI, embalagem 1, iguala o unitário da NF', () => {
    const custo = calcularCustoUnitarioEntrada({
      quantidadeNf: 3,
      valorUnitario: 7.5,
      custoFreteRateado: 0,
      valorIpi: 0,
      itensPorEmbalagem: 1,
    })
    expect(custo).toBe(7.5)
  })

  it('rateia frete na unidade de venda', () => {
    const custo = calcularCustoUnitarioEntrada({
      quantidadeNf: 2,
      valorUnitario: 10,
      custoFreteRateado: 4,
      valorIpi: 0,
      itensPorEmbalagem: 5,
    })
    expect(custo).toBe(2.4)
  })

  it('soma IPI (vIPI) na linha antes de dividir pela qtd de estoque', () => {
    const custo = calcularCustoUnitarioEntrada({
      quantidadeNf: 2,
      valorUnitario: 10,
      custoFreteRateado: 0,
      valorIpi: 4,
      itensPorEmbalagem: 2,
    })
    expect(custo).toBe(6)
  })
})

describe('montarCustoComparativo', () => {
  it('primeira compra (sem histórico) deixa anterior e variação vazios', () => {
    const r = montarCustoComparativo({
      quantidadeNf: 1,
      valorUnitario: 10,
      itensPorEmbalagem: 1,
      produtoId: 'prod-1',
      ultimaPorProduto: new Map(),
    })
    expect(r.custoEntrada).toBe(10)
    expect(r.custoAnterior).toBeNull()
    expect(r.variacaoPercentual).toBeNull()
  })

  it('sem produto não compara histórico', () => {
    const ultima = new Map<string, UltimoCustoConsolidado>([
      ['prod-1', { produtoId: 'prod-1', precoUnitarioVenda: 10, custoEntrada: 10 }],
    ])
    const r = montarCustoComparativo({
      quantidadeNf: 1,
      valorUnitario: 12,
      itensPorEmbalagem: 1,
      produtoId: null,
      ultimaPorProduto: ultima,
    })
    expect(r.custoAnterior).toBeNull()
    expect(r.variacaoPercentual).toBeNull()
  })

  it('embalagem errada explode a variação em relação à última entrada', () => {
    const ultima = new Map<string, UltimoCustoConsolidado>([
      ['prod-1', { produtoId: 'prod-1', precoUnitarioVenda: 10, custoEntrada: 10 }],
    ])
    const r = montarCustoComparativo({
      quantidadeNf: 1,
      valorUnitario: 10,
      itensPorEmbalagem: 10,
      produtoId: 'prod-1',
      ultimaPorProduto: ultima,
    })
    expect(r.custoEntrada).toBe(1)
    expect(r.custoAnterior).toBe(10)
    expect(r.variacaoPercentual).toBe(-0.9)
    expect(Math.abs(r.variacaoPercentual ?? 0)).toBeGreaterThanOrEqual(
      LIMIAR_DESTAQUE_VARIACAO_CUSTO
    )
  })

  it('outro tenant (mapa vazio da empresa) não herda custo anterior', () => {
    const r = montarCustoComparativo({
      quantidadeNf: 1,
      valorUnitario: 20,
      itensPorEmbalagem: 1,
      produtoId: 'prod-1',
      ultimaPorProduto: new Map(),
    })
    expect(r.custoAnterior).toBeNull()
    expect(r.variacaoPercentual).toBeNull()
  })
})

describe('calcularVariacaoCusto', () => {
  it('devolve sinal relativo ao anterior', () => {
    expect(calcularVariacaoCusto(13, 10)).toBeCloseTo(0.3)
    expect(calcularVariacaoCusto(7, 10)).toBeCloseTo(-0.3)
  })
})
