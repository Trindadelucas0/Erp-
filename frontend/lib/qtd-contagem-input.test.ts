import { describe, expect, it } from 'vitest'
import { textoQtdParaNumero } from './qtd-contagem-input'

describe('textoQtdParaNumero', () => {
  it('vazio vira 0', () => {
    expect(textoQtdParaNumero('')).toBe(0)
    expect(textoQtdParaNumero('   ')).toBe(0)
  })

  it('zero explícito permanece 0', () => {
    expect(textoQtdParaNumero('0')).toBe(0)
  })

  it('inteiro positivo', () => {
    expect(textoQtdParaNumero('54')).toBe(54)
  })

  it('decimal positivo', () => {
    expect(textoQtdParaNumero('1.5')).toBe(1.5)
  })

  it('texto inválido vira 0', () => {
    expect(textoQtdParaNumero('abc')).toBe(0)
  })

  it('negativo vira 0', () => {
    expect(textoQtdParaNumero('-1')).toBe(0)
  })
})
