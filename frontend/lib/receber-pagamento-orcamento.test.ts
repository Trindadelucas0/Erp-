import { describe, expect, it } from 'vitest'
import {
  formaPadraoDoOrcamento,
  termoBuscaLeitor,
  termoBuscaTotem,
} from './receber-pagamento-orcamento'

describe('formaPadraoDoOrcamento', () => {
  it('prazo 30 dias não escolhe a forma; o padrão é pix', () => {
    expect(formaPadraoDoOrcamento('30_dias')).toBe('pix')
    expect(formaPadraoDoOrcamento('cartao_credito')).toBe('pix')
  })
})

describe('termoBuscaTotem', () => {
  it('numero: 123 vira ORC-000123', () => {
    expect(termoBuscaTotem('numero', '123')).toBe('ORC-000123')
  })

  it('numero: vazio ou mais de 6 dígitos retorna null', () => {
    expect(termoBuscaTotem('numero', '')).toBeNull()
    expect(termoBuscaTotem('numero', '1234567')).toBeNull()
  })

  it('documento: 11 e 14 dígitos passam', () => {
    expect(termoBuscaTotem('documento', '12345678901')).toBe('12345678901')
    expect(termoBuscaTotem('documento', '12345678901234')).toBe('12345678901234')
  })

  it('documento: 10 dígitos retorna null', () => {
    expect(termoBuscaTotem('documento', '1234567890')).toBeNull()
  })
})

describe('termoBuscaLeitor', () => {
  it('aceita ORC-000123', () => {
    expect(termoBuscaLeitor('ORC-000123')).toBe('ORC-000123')
  })

  it('normaliza ORC-123', () => {
    expect(termoBuscaLeitor('ORC-123')).toBe('ORC-000123')
  })
})
