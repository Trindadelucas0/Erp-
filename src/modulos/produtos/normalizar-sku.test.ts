import { describe, expect, it } from 'vitest'
import {
  normalizarSkuProduto,
  tokenExigeBuscaSemPonto,
  tokensSkuParaBusca,
} from './normalizar-sku.js'

describe('normalizarSkuProduto', () => {
  it('remove pontos do SKU', () => {
    expect(normalizarSkuProduto('9.325')).toBe('9325')
    expect(normalizarSkuProduto('13.694')).toBe('13694')
    expect(normalizarSkuProduto('1.234')).toBe('1234')
  })

  it('mantém SKU numérico sem ponto', () => {
    expect(normalizarSkuProduto('9325')).toBe('9325')
  })

  it('faz trim nas pontas', () => {
    expect(normalizarSkuProduto('  9.325  ')).toBe('9325')
  })

  it('retorna undefined para vazio ou só pontos', () => {
    expect(normalizarSkuProduto('')).toBeUndefined()
    expect(normalizarSkuProduto('   ')).toBeUndefined()
    expect(normalizarSkuProduto('...')).toBeUndefined()
    expect(normalizarSkuProduto(null)).toBeUndefined()
    expect(normalizarSkuProduto(undefined)).toBeUndefined()
  })

  it('preserva SKU alfanumérico sem ponto', () => {
    expect(normalizarSkuProduto('ABC-123')).toBe('ABC-123')
  })
})

describe('tokensSkuParaBusca', () => {
  it('inclui o termo com e sem ponto', () => {
    expect(tokensSkuParaBusca('9.325')).toEqual(['9.325', '9325'])
    expect(tokensSkuParaBusca('  9.325  ')).toEqual(['9.325', '9325'])
  })

  it('não duplica quando já está sem ponto', () => {
    expect(tokensSkuParaBusca('9325')).toEqual(['9325'])
  })

  it('ignora só pontos ou vazio', () => {
    expect(tokensSkuParaBusca('')).toEqual([])
    expect(tokensSkuParaBusca('...')).toEqual([])
    expect(tokensSkuParaBusca('   ')).toEqual([])
  })
})

describe('tokenExigeBuscaSemPonto', () => {
  it('é verdadeiro com ponto ou dígito', () => {
    expect(tokenExigeBuscaSemPonto('9.325')).toBe(true)
    expect(tokenExigeBuscaSemPonto('6500')).toBe(true)
  })

  it('é falso para palavra sem dígito', () => {
    expect(tokenExigeBuscaSemPonto('esgoto')).toBe(false)
  })
})
