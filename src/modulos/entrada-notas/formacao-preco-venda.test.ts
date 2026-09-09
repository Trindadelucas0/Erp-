import { describe, expect, it } from 'vitest'
import {
  MSG_CARGA_INVALIDA,
  calcularDiferencaPercentualPreco,
  calcularMargemDePreco,
  calcularPrecoSugerido,
} from './formacao-preco-venda.js'

describe('calcularPrecoSugerido', () => {
  it('com encargos 25% e margem 0, preço = custo / 0,75', () => {
    const r = calcularPrecoSugerido(75, 25, 0)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.precoSugerido).toBe(100)
      expect(r.cargaPercentual).toBe(25)
    }
  })

  it('soma encargos e margem no divisor', () => {
    const r = calcularPrecoSugerido(63.6, 25.25, 11.15)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.cargaPercentual).toBeCloseTo(36.4)
      expect(r.precoSugerido).toBeCloseTo(63.6 / (1 - 0.364), 4)
    }
  })

  it('recusa carga >= 100', () => {
    const r = calcularPrecoSugerido(10, 80, 20)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe(MSG_CARGA_INVALIDA)
  })

  it('recusa custo inválido', () => {
    expect(calcularPrecoSugerido(null, 10, 0).ok).toBe(false)
    expect(calcularPrecoSugerido(0, 10, 0).ok).toBe(false)
  })
})

describe('calcularMargemDePreco', () => {
  it('inverte a fórmula a partir do preço digitado', () => {
    const r = calcularMargemDePreco(75, 25, 100)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.margemPercentual).toBeCloseTo(0)
      expect(r.precoSugerido).toBeCloseTo(100)
    }
  })

  it('recusa preço zero', () => {
    expect(calcularMargemDePreco(10, 10, 0).ok).toBe(false)
  })
})

describe('calcularDiferencaPercentualPreco', () => {
  it('compara sugerido com o preço atual do cadastro', () => {
    expect(calcularDiferencaPercentualPreco(110, 100)).toBeCloseTo(0.1)
    expect(calcularDiferencaPercentualPreco(90, 100)).toBeCloseTo(-0.1)
    expect(calcularDiferencaPercentualPreco(100, null)).toBeNull()
  })
})
